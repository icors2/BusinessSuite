import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuoteLineKind, QuoteStatus } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { CpqCatalogService } from './catalog.service';
import {
  AssemblyInput,
  buildFabPartFromPayload,
  costAssembly,
  costFabPart,
  InMemoryEngineCatalog,
} from './engine';
import { CPQ_EVENTS } from './events';
import { FormulaCatalog } from './formulas';
import {
  lineTotal,
  priceBreaks,
  priceProductLine,
  unitPriceAtQty,
} from './pricing';
import { PricingConfig, RateCard } from './rate-card';
import {
  AddFabricatedLineInput,
  AddProductLineInput,
  CreateQuoteInput,
  ListQuotesInput,
  PricePreviewInput,
  UpdateLineInput,
} from './schemas';

export const QUOTE_TRANSITIONS: Record<
  QuoteStatus,
  Partial<Record<'send' | 'accept' | 'reject' | 'expire', QuoteStatus>>
> = {
  DRAFT: { send: QuoteStatus.SENT },
  SENT: {
    accept: QuoteStatus.ACCEPTED,
    reject: QuoteStatus.REJECTED,
    expire: QuoteStatus.EXPIRED,
  },
  ACCEPTED: {},
  REJECTED: {},
  EXPIRED: {},
};

const quoteInclude = {
  customer: true,
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: { product: true },
  },
};

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CpqCatalogService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateQuoteInput, actorId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${input.customerId} not found`);
    }

    const quoteNumber = await this.nextQuoteNumber();
    const quote = await this.prisma.quote.create({
      data: {
        quoteNumber,
        customerId: input.customerId,
        validUntil: input.validUntil,
        notes: input.notes?.trim() || null,
        currency: input.currency ?? 'USD',
        createdById: actorId ?? null,
      },
      include: quoteInclude,
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Quote',
      entityId: quote.id,
      metadata: { quoteNumber, customerId: input.customerId },
    });

    await this.eventBus.publish(CPQ_EVENTS.quote.created, {
      entityId: quote.id,
      actorId,
      payload: {
        quoteId: quote.id,
        quoteNumber,
        customerId: input.customerId,
        status: quote.status,
      },
    });

    return quote;
  }

  async getById(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: quoteInclude,
    });
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found`);
    return quote;
  }

  async list(input: ListQuotesInput) {
    const where: Prisma.QuoteWhereInput = {};
    if (input.customerId) where.customerId = input.customerId;
    if (input.status) where.status = input.status;
    if (input.search?.trim()) {
      const s = input.search.trim();
      where.OR = [
        { quoteNumber: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        { customer: { name: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        include: { customer: true, lines: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { items, total };
  }

  async addProductLine(input: AddProductLineInput, actorId?: string) {
    const quote = await this.getDraftQuote(input.quoteId);
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException(`Product ${input.productId} not found`);

    const customer = await this.prisma.customer.findUnique({
      where: { id: quote.customerId },
    });
    const pricingConfig = await this.catalog.loadPricingConfig();
    const listPrice = product.listPrice != null ? Number(product.listPrice) : 0;

    if (input.manualUnitPrice != null && !input.overrideReason?.trim()) {
      throw new BadRequestException(
        'overrideReason is required when manualUnitPrice is set',
      );
    }

    const priced = priceProductLine(
      {
        listPrice,
        quantity: input.quantity,
        priceTier: customer?.priceTier,
        manualUnitPrice: input.manualUnitPrice,
        overrideReason: input.overrideReason,
      },
      pricingConfig,
    );

    const lineNumber = await this.nextLineNumber(input.quoteId);
    const line = await this.prisma.quoteLine.create({
      data: {
        quoteId: input.quoteId,
        lineNumber,
        kind: QuoteLineKind.PRODUCT,
        productId: input.productId,
        description: product.description,
        quantity: input.quantity,
        unitPrice: priced.unitPrice,
        discountPct: priced.discountPct,
        manualUnitPrice: input.manualUnitPrice ?? null,
        overrideReason: input.overrideReason?.trim() || null,
        lineTotal: lineTotal(priced.unitPrice, input.quantity, priced.discountPct),
      },
      include: { product: true },
    });

    await this.recalcTotals(input.quoteId);
    await this.audit.record({
      actorId,
      action: 'addLine',
      entityType: 'QuoteLine',
      entityId: line.id,
      metadata: { quoteId: input.quoteId, kind: 'PRODUCT' },
    });
    return line;
  }

  async addFabricatedLine(input: AddFabricatedLineInput, actorId?: string) {
    await this.getDraftQuote(input.quoteId);
    const preview = await this.pricePreview({
      fabInput: input.fabInput,
      quantity: input.quantity,
    });

    const lineNumber = await this.nextLineNumber(input.quoteId);
    const line = await this.prisma.quoteLine.create({
      data: {
        quoteId: input.quoteId,
        lineNumber,
        kind: QuoteLineKind.FABRICATED,
        description: input.description.trim(),
        quantity: input.quantity,
        unitPrice: preview.unitPrice,
        discountPct: 0,
        lineTotal: lineTotal(preview.unitPrice, input.quantity),
        fabInput: input.fabInput as Prisma.InputJsonValue,
        costBreakdown: preview as unknown as Prisma.InputJsonValue,
      },
    });

    await this.recalcTotals(input.quoteId);
    await this.audit.record({
      actorId,
      action: 'addLine',
      entityType: 'QuoteLine',
      entityId: line.id,
      metadata: { quoteId: input.quoteId, kind: 'FABRICATED' },
    });
    return line;
  }

  async updateLine(input: UpdateLineInput, actorId?: string) {
    const quote = await this.getDraftQuote(input.quoteId);
    const existing = await this.prisma.quoteLine.findFirst({
      where: { id: input.lineId, quoteId: input.quoteId },
      include: { product: true },
    });
    if (!existing) throw new NotFoundException(`Line ${input.lineId} not found`);

    if (
      input.manualUnitPrice != null &&
      input.overrideReason !== undefined &&
      !input.overrideReason?.trim()
    ) {
      throw new BadRequestException(
        'overrideReason is required when manualUnitPrice is set',
      );
    }

    const data: Prisma.QuoteLineUpdateInput = {};
    if (input.description) data.description = input.description.trim();
    if (input.quantity != null) data.quantity = input.quantity;
    if (input.fabInput && existing.kind === QuoteLineKind.FABRICATED) {
      data.fabInput = input.fabInput as Prisma.InputJsonValue;
    }
    if (input.manualUnitPrice !== undefined) {
      data.manualUnitPrice = input.manualUnitPrice;
    }
    if (input.overrideReason !== undefined) {
      data.overrideReason = input.overrideReason?.trim() || null;
    }

    const qty = Number(input.quantity ?? existing.quantity);
    if (existing.kind === QuoteLineKind.PRODUCT && existing.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: existing.productId },
      });
      const customer = await this.prisma.customer.findUnique({
        where: { id: quote.customerId },
      });
      const pricingConfig = await this.catalog.loadPricingConfig();
      const manual =
        input.manualUnitPrice !== undefined
          ? input.manualUnitPrice
          : existing.manualUnitPrice != null
            ? Number(existing.manualUnitPrice)
            : null;
      const reason =
        input.overrideReason !== undefined
          ? input.overrideReason
          : existing.overrideReason;
      const priced = priceProductLine(
        {
          listPrice: product?.listPrice != null ? Number(product.listPrice) : 0,
          quantity: qty,
          priceTier: customer?.priceTier,
          manualUnitPrice: manual,
          overrideReason: reason,
        },
        pricingConfig,
      );
      data.unitPrice = priced.unitPrice;
      data.discountPct = priced.discountPct;
      data.lineTotal = lineTotal(priced.unitPrice, qty, priced.discountPct);
    }

    if (existing.kind === QuoteLineKind.FABRICATED) {
      const fabInput =
        (input.fabInput as Record<string, unknown>) ??
        (existing.fabInput as Record<string, unknown>);
      const preview = await this.pricePreview({ fabInput, quantity: qty });
      data.unitPrice = preview.unitPrice;
      data.costBreakdown = preview as unknown as Prisma.InputJsonValue;
      data.lineTotal = lineTotal(preview.unitPrice, qty);
    }

    const line = await this.prisma.quoteLine.update({
      where: { id: input.lineId },
      data,
      include: { product: true },
    });

    await this.recalcTotals(input.quoteId);
    await this.audit.record({
      actorId,
      action: 'updateLine',
      entityType: 'QuoteLine',
      entityId: line.id,
      metadata: { quoteId: input.quoteId },
    });
    return line;
  }

  async removeLine(quoteId: string, lineId: string, actorId?: string) {
    await this.getDraftQuote(quoteId);
    const existing = await this.prisma.quoteLine.findFirst({
      where: { id: lineId, quoteId },
    });
    if (!existing) throw new NotFoundException(`Line ${lineId} not found`);

    await this.prisma.quoteLine.delete({ where: { id: lineId } });
    await this.renumberLines(quoteId);
    await this.recalcTotals(quoteId);

    await this.audit.record({
      actorId,
      action: 'removeLine',
      entityType: 'QuoteLine',
      entityId: lineId,
      metadata: { quoteId },
    });

    return { ok: true };
  }

  async recalc(quoteId: string, actorId?: string) {
    const quote = await this.getDraftQuote(quoteId);
    const lines = await this.prisma.quoteLine.findMany({
      where: { quoteId },
      include: { product: true },
      orderBy: { lineNumber: 'asc' },
    });

    const customer = await this.prisma.customer.findUnique({
      where: { id: quote.customerId },
    });
    const pricingConfig = await this.catalog.loadPricingConfig();
    const rateCard = await this.catalog.loadRateCard();
    const formulas = await this.catalog.loadFormulas();
    const engineCatalog = await this.buildEngineCatalogForLines(lines);

    for (const line of lines) {
      const qty = Number(line.quantity);
      if (line.kind === QuoteLineKind.PRODUCT && line.productId) {
        const product = line.product;
        const priced = priceProductLine(
          {
            listPrice: product?.listPrice != null ? Number(product.listPrice) : 0,
            quantity: qty,
            priceTier: customer?.priceTier,
            manualUnitPrice:
              line.manualUnitPrice != null ? Number(line.manualUnitPrice) : null,
            overrideReason: line.overrideReason,
          },
          pricingConfig,
        );
        await this.prisma.quoteLine.update({
          where: { id: line.id },
          data: {
            unitPrice: priced.unitPrice,
            discountPct: priced.discountPct,
            lineTotal: lineTotal(priced.unitPrice, qty, priced.discountPct),
          },
        });
      } else if (line.kind === QuoteLineKind.FABRICATED && line.fabInput) {
        const preview = await this.pricePreviewInternal(
          line.fabInput as Record<string, unknown>,
          qty,
          rateCard,
          pricingConfig,
          formulas,
          engineCatalog,
        );
        await this.prisma.quoteLine.update({
          where: { id: line.id },
          data: {
            unitPrice: preview.unitPrice,
            costBreakdown: preview as unknown as Prisma.InputJsonValue,
            lineTotal: lineTotal(preview.unitPrice, qty),
          },
        });
      }
    }

    const updated = await this.recalcTotals(quoteId);
    await this.audit.record({
      actorId,
      action: 'recalc',
      entityType: 'Quote',
      entityId: quoteId,
      metadata: { total: Number(updated.total) },
    });
    return this.getById(quoteId);
  }

  async transition(
    quoteId: string,
    action: 'send' | 'accept' | 'reject' | 'expire',
    actorId?: string,
  ) {
    const quote = await this.getById(quoteId);
    const next = QUOTE_TRANSITIONS[quote.status][action];
    if (!next) {
      throw new BadRequestException(
        `Cannot ${action} quote in status ${quote.status}`,
      );
    }

    if (action === 'accept' && quote.validUntil && quote.validUntil < new Date()) {
      await this.prisma.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.EXPIRED },
      });
      await this.eventBus.publish(CPQ_EVENTS.quote.expired, {
        entityId: quoteId,
        actorId,
        payload: { quoteId, quoteNumber: quote.quoteNumber, reason: 'validUntil' },
      });
      throw new BadRequestException('Cannot accept an expired quote');
    }

    const data: Prisma.QuoteUpdateInput = { status: next };
    if (action === 'send') {
      data.sentAt = new Date();
      data.pricingSnapshot = (await this.buildPricingSnapshot(
        quoteId,
      )) as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data,
      include: quoteInclude,
    });

    await this.audit.record({
      actorId,
      action,
      entityType: 'Quote',
      entityId: quoteId,
      metadata: { from: quote.status, to: next },
    });

    const eventMap = {
      send: CPQ_EVENTS.quote.sent,
      accept: CPQ_EVENTS.quote.accepted,
      reject: CPQ_EVENTS.quote.rejected,
      expire: CPQ_EVENTS.quote.expired,
    } as const;

    const payload =
      action === 'accept'
        ? {
            quoteId: updated.id,
            quoteNumber: updated.quoteNumber,
            customerId: updated.customerId,
            total: Number(updated.total),
            currency: updated.currency,
            lines: updated.lines.map((l) => ({
              kind: l.kind,
              productId: l.productId,
              description: l.description,
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
              lineTotal: Number(l.lineTotal),
            })),
          }
        : {
            quoteId: updated.id,
            quoteNumber: updated.quoteNumber,
            customerId: updated.customerId,
            status: updated.status,
          };

    await this.eventBus.publish(eventMap[action], {
      entityId: quoteId,
      actorId,
      payload,
    });

    return updated;
  }

  async pricePreview(input: PricePreviewInput) {
    const rateCard = input.rateCard
      ? RateCard.fromDict(input.rateCard)
      : await this.catalog.loadRateCard();
    const pricingConfig = input.pricing
      ? PricingConfig.fromDict(input.pricing)
      : await this.catalog.loadPricingConfig();
    const formulas = await this.catalog.loadFormulas();
    const engineCatalog = input.fabInput
      ? await this.buildEngineCatalogForFab(input.fabInput)
      : input.parts
        ? await this.catalog.buildEngineCatalog(
            input.parts.flatMap((p) =>
              this.collectItemNumbers(p as Record<string, unknown>),
            ),
          )
        : new InMemoryEngineCatalog();

    if (input.parts?.length) {
      const assembly: AssemblyInput = {
        name: 'Preview',
        itemNumber: 'PREVIEW',
        customer: '',
        parts: input.parts.map((p) => buildFabPartFromPayload(p)),
      };
      const result = costAssembly(assembly, rateCard, engineCatalog, formulas);
      const pricing = priceBreaks(result, pricingConfig, formulas);
      return {
        assembly: result.toDict(),
        pricing: pricing.toDict(),
        unitPrice: unitPriceAtQty(result, pricingConfig, input.quantity, formulas),
      };
    }

    if (input.fabInput) {
      return this.pricePreviewInternal(
        input.fabInput,
        input.quantity,
        rateCard,
        pricingConfig,
        formulas,
        engineCatalog,
      );
    }

    throw new BadRequestException('fabInput or parts is required');
  }

  private async pricePreviewInternal(
    fabInput: Record<string, unknown>,
    quantity: number,
    rateCard: RateCard,
    pricingConfig: PricingConfig,
    formulas: FormulaCatalog,
    engineCatalog: InMemoryEngineCatalog,
  ) {
    const part = buildFabPartFromPayload(fabInput);
    const partResult = costFabPart(part, rateCard, engineCatalog, formulas);
    const assembly: AssemblyInput = {
      name: part.name || 'Part',
      itemNumber: part.itemNumber,
      customer: '',
      parts: [part],
    };
    const asmResult = costAssembly(assembly, rateCard, engineCatalog, formulas);
    const pricing = priceBreaks(asmResult, pricingConfig, formulas);
    const unitPrice = unitPriceAtQty(asmResult, pricingConfig, quantity, formulas);
    return {
      part: partResult.toDict(),
      assembly: asmResult.toDict(),
      pricing: pricing.toDict(),
      unitPrice,
      totalSetups: asmResult.totalSetups,
    };
  }

  private collectItemNumbers(fabInput: Record<string, unknown>): string[] {
    const nums: string[] = [];
    const mat = fabInput['material'] ?? fabInput['itemNumber'] ?? fabInput['item_number'];
    if (typeof mat === 'string' && mat) nums.push(mat);
    return nums;
  }

  private async buildEngineCatalogForFab(
    fabInput: Record<string, unknown>,
  ): Promise<InMemoryEngineCatalog> {
    return this.catalog.buildEngineCatalog(this.collectItemNumbers(fabInput));
  }

  private async buildEngineCatalogForLines(
    lines: Array<{ fabInput: unknown }>,
  ): Promise<InMemoryEngineCatalog> {
    const nums: string[] = [];
    for (const line of lines) {
      if (line.fabInput && typeof line.fabInput === 'object') {
        nums.push(...this.collectItemNumbers(line.fabInput as Record<string, unknown>));
      }
    }
    return this.catalog.buildEngineCatalog(nums);
  }

  private async buildPricingSnapshot(quoteId: string) {
    const [rateCard, pricingConfig, formulas, quote] = await Promise.all([
      this.catalog.loadRateCard(),
      this.catalog.loadPricingConfig(),
      this.catalog.loadFormulas(),
      this.getById(quoteId),
    ]);

    return {
      frozenAt: new Date().toISOString(),
      rateCard: rateCard.toDict(),
      pricingConfig: pricingConfig.toDict(),
      formulaOverrides: formulas.overrides,
      lines: quote.lines.map((l) => ({
        lineId: l.id,
        lineNumber: l.lineNumber,
        kind: l.kind,
        unitPrice: Number(l.unitPrice),
        discountPct: Number(l.discountPct),
        lineTotal: Number(l.lineTotal),
        quantity: Number(l.quantity),
      })),
      totals: {
        subtotal: Number(quote.subtotal),
        discountTotal: Number(quote.discountTotal),
        total: Number(quote.total),
      },
    };
  }

  private async recalcTotals(quoteId: string) {
    const lines = await this.prisma.quoteLine.findMany({ where: { quoteId } });
    let subtotal = 0;
    let discountTotal = 0;
    for (const line of lines) {
      const gross = Number(line.unitPrice) * Number(line.quantity);
      const disc = gross * (Number(line.discountPct) / 100);
      subtotal += gross;
      discountTotal += disc;
    }
    const total = Math.round((subtotal - discountTotal) * 100) / 100;
    return this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        subtotal: Math.round(subtotal * 100) / 100,
        discountTotal: Math.round(discountTotal * 100) / 100,
        total,
      },
    });
  }

  private async getDraftQuote(quoteId: string) {
    const quote = await this.getById(quoteId);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Quote is not editable in status ' + quote.status);
    }
    return quote;
  }

  private async nextQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `Q-${year}-`;
    const latest = await this.prisma.quote.findFirst({
      where: { quoteNumber: { startsWith: prefix } },
      orderBy: { quoteNumber: 'desc' },
    });
    const seq = latest
      ? Number(latest.quoteNumber.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async nextLineNumber(quoteId: string): Promise<number> {
    const max = await this.prisma.quoteLine.aggregate({
      where: { quoteId },
      _max: { lineNumber: true },
    });
    return (max._max.lineNumber ?? 0) + 1;
  }

  private async renumberLines(quoteId: string) {
    const lines = await this.prisma.quoteLine.findMany({
      where: { quoteId },
      orderBy: { lineNumber: 'asc' },
    });
    for (let i = 0; i < lines.length; i++) {
      await this.prisma.quoteLine.update({
        where: { id: lines[i].id },
        data: { lineNumber: i + 1 },
      });
    }
  }
}
