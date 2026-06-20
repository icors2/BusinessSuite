import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseOrderStatus,
  RequisitionStatus,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { InventoryService } from 'wms';
import { consolidateRequisitions } from './consolidation';
import { PROCUREMENT_EVENTS } from './events';
import { formatPoNumber, parsePoSequence } from './numbering';
import { computeScorecard } from './scorecard';
import {
  AcknowledgePoInput,
  CreatePurchaseOrdersInput,
  IssuePoInput,
  ListPurchaseOrdersInput,
  ReceiveAgainstPoInput,
  SubmitAsnInput,
  VendorScorecardInput,
} from './schemas';

const poInclude = {
  vendor: true,
  lines: {
    include: {
      product: true,
      requisition: true,
      receipts: { orderBy: { receivedAt: 'asc' as const } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  acknowledgments: { orderBy: { acknowledgedAt: 'desc' as const } },
  asns: {
    include: { lines: { include: { product: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventoryService: InventoryService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async createPurchaseOrders(
    input: CreatePurchaseOrdersInput,
    actorId?: string,
  ) {
    const requisitions = await this.prisma.purchaseRequisition.findMany({
      where: {
        id: { in: input.requisitionIds },
        status: RequisitionStatus.APPROVED,
        purchaseOrderLine: null,
      },
      include: { component: true },
    });

    if (requisitions.length === 0) {
      throw new BadRequestException(
        'No approved, unconverted requisitions found for the given IDs',
      );
    }

    const { drafts, skipped } = consolidateRequisitions(
      requisitions.map((r) => ({
        id: r.id,
        componentProductId: r.componentProductId,
        componentSku: r.component.sku,
        componentDescription: r.component.description,
        quantity: toNumber(r.quantity),
        needByDate: r.needByDate,
        preferredVendorId: r.preferredVendorId,
        listPrice: r.component.listPrice
          ? toNumber(r.component.listPrice)
          : null,
      })),
    );

    const created: Prisma.PurchaseOrderGetPayload<{
      include: typeof poInclude;
    }>[] = [];

    for (const draft of drafts) {
      const poNumber = await this.nextPoNumber();
      const subtotal = draft.lines.reduce((sum, l) => sum + l.lineTotal, 0);

      const po = await this.prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.create({
          data: {
            poNumber,
            vendorId: draft.vendorId,
            status: PurchaseOrderStatus.DRAFT,
            expectedDeliveryDate: draft.expectedDeliveryDate,
            demandRefs: draft.demandRefs,
            subtotal,
            total: subtotal,
            lines: {
              create: draft.lines.map((line) => ({
                productId: line.productId,
                requisitionId: line.requisitionId,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
                expectedDeliveryDate: line.expectedDeliveryDate,
              })),
            },
          },
          include: poInclude,
        });

        await tx.purchaseRequisition.updateMany({
          where: { id: { in: draft.lines.map((l) => l.requisitionId) } },
          data: { status: RequisitionStatus.CONVERTED },
        });

        return order;
      });

      created.push(po);

      await this.audit.record({
        actorId,
        action: 'procurement.po.created',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        metadata: { poNumber: po.poNumber, vendorId: po.vendorId },
      });
    }

    return {
      created: created.map((po) => this.mapPurchaseOrder(po)),
      skipped,
    };
  }

  async issuePurchaseOrder(input: IssuePoInput, actorId?: string) {
    const po = await this.getPoOrThrow(input.purchaseOrderId);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot issue PO in status ${po.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: PurchaseOrderStatus.ISSUED },
      include: poInclude,
    });

    await this.eventBus.publish(PROCUREMENT_EVENTS.po.issued, {
      entityId: updated.id,
      actorId,
      payload: {
        purchaseOrderId: updated.id,
        poNumber: updated.poNumber,
        vendorId: updated.vendorId,
        total: toNumber(updated.total),
      },
    });

    await this.audit.record({
      actorId,
      action: 'procurement.po.issued',
      entityType: 'PurchaseOrder',
      entityId: updated.id,
      metadata: { poNumber: updated.poNumber },
    });

    return this.mapPurchaseOrder(updated);
  }

  async acknowledgePurchaseOrder(
    input: AcknowledgePoInput,
    actorId?: string,
  ) {
    // Phase 10: EDI / public vendor portal would plug in here.
    const po = await this.getPoOrThrow(input.purchaseOrderId);
    if (
      po.status !== PurchaseOrderStatus.ISSUED &&
      po.status !== PurchaseOrderStatus.ACKNOWLEDGED
    ) {
      throw new BadRequestException(
        `Cannot acknowledge PO in status ${po.status}`,
      );
    }

    const acknowledgment = await this.prisma.vendorAcknowledgment.create({
      data: {
        poId: po.id,
        confirmedDeliveryDate: input.confirmedDeliveryDate ?? null,
        note: input.note?.trim() || null,
      },
    });

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: PurchaseOrderStatus.ACKNOWLEDGED },
      include: poInclude,
    });

    await this.eventBus.publish(PROCUREMENT_EVENTS.po.acknowledged, {
      entityId: po.id,
      actorId,
      payload: {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        acknowledgmentId: acknowledgment.id,
        confirmedDeliveryDate: acknowledgment.confirmedDeliveryDate,
      },
    });

    await this.audit.record({
      actorId,
      action: 'procurement.po.acknowledged',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      metadata: { acknowledgmentId: acknowledgment.id },
    });

    return this.mapPurchaseOrder(updated);
  }

  async submitAsn(input: SubmitAsnInput, actorId?: string) {
    // Phase 10: EDI / public vendor portal would plug in here.
    const po = await this.getPoOrThrow(input.purchaseOrderId);
    if (
      po.status === PurchaseOrderStatus.DRAFT ||
      po.status === PurchaseOrderStatus.CANCELLED ||
      po.status === PurchaseOrderStatus.CLOSED
    ) {
      throw new BadRequestException(`Cannot submit ASN for PO in ${po.status}`);
    }

    const asn = await this.prisma.advanceShipmentNotice.create({
      data: {
        poId: po.id,
        shipDate: input.shipDate ?? null,
        expectedArrival: input.expectedArrival ?? null,
        carrier: input.carrier?.trim() || null,
        trackingNumber: input.trackingNumber?.trim() || null,
        lines: {
          create: input.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: true },
    });

    await this.eventBus.publish(PROCUREMENT_EVENTS.asn.received, {
      entityId: asn.id,
      actorId,
      payload: {
        purchaseOrderId: po.id,
        asnId: asn.id,
        expectedArrival: asn.expectedArrival,
        lineCount: asn.lines.length,
      },
    });

    await this.audit.record({
      actorId,
      action: 'procurement.asn.received',
      entityType: 'AdvanceShipmentNotice',
      entityId: asn.id,
      metadata: { poId: po.id },
    });

    return this.getPurchaseOrder(po.id);
  }

  async receiveAgainstPo(input: ReceiveAgainstPoInput, actorId?: string) {
    const line = await this.prisma.purchaseOrderLine.findUnique({
      where: { id: input.poLineId },
      include: {
        po: true,
        product: true,
        receipts: true,
      },
    });
    if (!line) {
      throw new NotFoundException(`PO line ${input.poLineId} not found`);
    }
    if (
      line.po.status === PurchaseOrderStatus.DRAFT ||
      line.po.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot receive against PO in status ${line.po.status}`,
      );
    }

    const ordered = toNumber(line.quantity);
    const alreadyReceived = toNumber(line.qtyReceived);
    const remaining = ordered - alreadyReceived;
    if (input.quantity > remaining + 0.0001) {
      throw new BadRequestException(
        `Receive quantity ${input.quantity} exceeds remaining ${remaining}`,
      );
    }

    const receivedAt = input.receivedAt ?? new Date();
    const note =
      input.note?.trim() ||
      `PO ${line.po.poNumber} line receipt`;

    const inventoryRow = await this.inventoryService.receive(
      {
        productId: line.productId,
        binId: input.binId,
        quantity: input.quantity,
        note,
      },
      actorId,
    );

    const movement = await this.prisma.inventoryMovement.findFirst({
      where: {
        productId: line.productId,
        binId: input.binId,
        type: 'RECEIPT',
      },
      orderBy: { createdAt: 'desc' },
    });

    const newQtyReceived = alreadyReceived + input.quantity;

    await this.prisma.poReceipt.create({
      data: {
        poLineId: line.id,
        quantity: input.quantity,
        receivedAt,
        movementId: movement?.id ?? null,
      },
    });

    const allLines = await this.prisma.purchaseOrderLine.findMany({
      where: { poId: line.poId },
    });
    const allFullyReceived = allLines.every((l) => {
      const qty =
        l.id === line.id ? newQtyReceived : toNumber(l.qtyReceived);
      return qty >= toNumber(l.quantity) - 0.0001;
    });
    const anyReceived = allLines.some((l) => {
      const qty =
        l.id === line.id ? newQtyReceived : toNumber(l.qtyReceived);
      return qty > 0;
    });

    const nextStatus = allFullyReceived
      ? PurchaseOrderStatus.RECEIVED
      : anyReceived
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
        : line.po.status;

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: line.poId },
      data: {
        status: nextStatus,
        lines: {
          update: {
            where: { id: line.id },
            data: { qtyReceived: newQtyReceived },
          },
        },
      },
      include: poInclude,
    });

    await this.audit.record({
      actorId,
      action: 'procurement.po.received',
      entityType: 'PurchaseOrderLine',
      entityId: line.id,
      metadata: {
        poNumber: line.po.poNumber,
        quantity: input.quantity,
        binId: input.binId,
        inventoryRowId: inventoryRow.id,
      },
    });

    return this.mapPurchaseOrder(updated);
  }

  async listPurchaseOrders(input: ListPurchaseOrdersInput) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.vendorId) where.vendorId = input.vendorId;

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: poInclude,
        orderBy: { createdAt: 'desc' },
        skip: input.skip ?? 0,
        take: input.take ?? 50,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      items: items.map((po) => this.mapPurchaseOrder(po)),
      total,
    };
  }

  async getPurchaseOrder(purchaseOrderId: string) {
    const po = await this.getPoOrThrow(purchaseOrderId);
    return this.mapPurchaseOrder(po);
  }

  async getVendorScorecard(input: VendorScorecardInput) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (input.vendorId) where.vendorId = input.vendorId;

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: true,
        lines: { include: { receipts: true } },
      },
    });

    const byVendor = new Map<
      string,
      {
        vendorId: string;
        vendorName: string;
        lines: Parameters<typeof computeScorecard>[0];
      }
    >();

    for (const po of orders) {
      const entry = byVendor.get(po.vendorId) ?? {
        vendorId: po.vendorId,
        vendorName: po.vendor.name,
        lines: [],
      };

      for (const line of po.lines) {
        entry.lines.push({
          lineId: line.id,
          productId: line.productId,
          orderedQty: toNumber(line.quantity),
          qtyReceived: toNumber(line.qtyReceived),
          expectedDeliveryDate: line.expectedDeliveryDate,
          receipts: line.receipts.map((r) => ({
            quantity: toNumber(r.quantity),
            receivedAt: r.receivedAt,
          })),
        });
      }

      byVendor.set(po.vendorId, entry);
    }

    const range = { from: input.from, to: input.to };
    let vendors = [...byVendor.values()].map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      metrics: computeScorecard(v.lines, range),
    }));

    if (input.vendorId) {
      vendors = vendors.filter((v) => v.vendorId === input.vendorId);
    }

    return { vendors };
  }

  private async getPoOrThrow(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: poInclude,
    });
    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return po;
  }

  private async nextPoNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const existing = await this.prisma.purchaseOrder.findMany({
      where: { poNumber: { startsWith: prefix } },
      select: { poNumber: true },
    });
    let maxSeq = 0;
    for (const row of existing) {
      const seq = parsePoSequence(row.poNumber, year);
      if (seq != null && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    return formatPoNumber(year, maxSeq + 1);
  }

  private mapPurchaseOrder(
    po: Prisma.PurchaseOrderGetPayload<{ include: typeof poInclude }>,
  ) {
    return {
      id: po.id,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      vendor: po.vendor
        ? { id: po.vendor.id, name: po.vendor.name, email: po.vendor.email }
        : null,
      status: po.status,
      orderDate: po.orderDate,
      expectedDeliveryDate: po.expectedDeliveryDate,
      notes: po.notes,
      subtotal: toNumber(po.subtotal),
      total: toNumber(po.total),
      lines: po.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        product: line.product
          ? {
              id: line.product.id,
              sku: line.product.sku,
              description: line.product.description,
            }
          : null,
        requisitionId: line.requisitionId,
        description: line.description,
        quantity: toNumber(line.quantity),
        unitPrice: line.unitPrice ? toNumber(line.unitPrice) : null,
        lineTotal: line.lineTotal ? toNumber(line.lineTotal) : null,
        expectedDeliveryDate: line.expectedDeliveryDate,
        qtyReceived: toNumber(line.qtyReceived),
        receipts: line.receipts.map((r) => ({
          id: r.id,
          quantity: toNumber(r.quantity),
          receivedAt: r.receivedAt,
          movementId: r.movementId,
        })),
      })),
      acknowledgments: po.acknowledgments.map((a) => ({
        id: a.id,
        confirmedDeliveryDate: a.confirmedDeliveryDate,
        note: a.note,
        acknowledgedAt: a.acknowledgedAt,
      })),
      asns: po.asns.map((asn) => ({
        id: asn.id,
        status: asn.status,
        shipDate: asn.shipDate,
        expectedArrival: asn.expectedArrival,
        carrier: asn.carrier,
        trackingNumber: asn.trackingNumber,
        lines: asn.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          product: l.product
            ? { id: l.product.id, sku: l.product.sku }
            : null,
          quantity: toNumber(l.quantity),
        })),
      })),
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
    };
  }
}
