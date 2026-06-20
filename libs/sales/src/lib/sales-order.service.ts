import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QuoteLineKind,
  QuoteStatus,
  SalesOrderLineKind,
  SalesOrderStatus,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { InvoiceService, roundMoney, toNumber } from 'finance';
import { InventoryService } from 'wms';
import {
  deriveOrderStatus,
  greedyAllocate,
  maxShippableQty,
} from './allocation';
import { SALES_EVENTS } from './events';
import {
  ConfirmShipmentInput,
  ConvertFromQuoteInput,
  ListOrdersInput,
} from './schemas';

const orderInclude = {
  customer: true,
  quote: true,
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: { product: true },
  },
  shipments: { orderBy: { shippedAt: 'desc' as const } },
};

type AllocationDetail = {
  binId: string;
  binCode?: string;
  quantity: number;
};

@Injectable()
export class SalesOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly invoiceService: InvoiceService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async convertFromQuote(input: ConvertFromQuoteInput, actorId?: string) {
    const existing = await this.prisma.salesOrder.findUnique({
      where: { quoteId: input.quoteId },
      include: orderInclude,
    });
    if (existing) {
      return this.mapOrder(existing);
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!quote) {
      throw new NotFoundException(`Quote ${input.quoteId} not found`);
    }
    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException(
        `Quote must be ACCEPTED to convert (current: ${quote.status})`,
      );
    }

    const orderNumber = await this.nextOrderNumber();
    const linesData = quote.lines.map((line) => {
      const qty = toNumber(line.quantity);
      const unitPrice = toNumber(line.unitPrice);
      const isFabricated = line.kind === QuoteLineKind.FABRICATED;
      return {
        lineNumber: line.lineNumber,
        kind:
          line.kind === QuoteLineKind.FABRICATED
            ? SalesOrderLineKind.FABRICATED
            : SalesOrderLineKind.PRODUCT,
        productId: line.productId,
        description: line.description,
        unitPrice,
        qtyOrdered: qty,
        qtyAllocated: 0,
        qtyShipped: 0,
        qtyBackordered: 0,
        toProduce: isFabricated,
        lineTotal: toNumber(line.lineTotal),
      };
    });

    const subtotal = roundMoney(
      linesData.reduce((sum, l) => sum + l.lineTotal, 0),
    );

    const order = await this.prisma.salesOrder.create({
      data: {
        orderNumber,
        quoteId: quote.id,
        customerId: quote.customerId,
        status: SalesOrderStatus.DRAFT,
        requestedShipDate: input.requestedShipDate ?? null,
        notes: input.notes?.trim() || quote.notes,
        currency: quote.currency,
        createdById: actorId ?? null,
        subtotal,
        total: subtotal,
        lines: { create: linesData },
      },
      include: orderInclude,
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'SalesOrder',
      entityId: order.id,
      metadata: { orderNumber, quoteId: quote.id },
    });

    await this.eventBus.publish(SALES_EVENTS.order.created, {
      entityId: order.id,
      actorId,
      payload: {
        orderId: order.id,
        orderNumber,
        quoteId: quote.id,
        customerId: quote.customerId,
        total: subtotal,
      },
    });

    return this.allocate(order.id, actorId);
  }

  async getById(orderId: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return this.mapOrder(order);
  }

  async list(input: ListOrdersInput) {
    const where: Prisma.SalesOrderWhereInput = {};

    if (input.customerId) where.customerId = input.customerId;
    if (input.status) where.status = input.status;
    if (input.search?.trim()) {
      where.OR = [
        { orderNumber: { contains: input.search.trim(), mode: 'insensitive' } },
        {
          customer: {
            name: { contains: input.search.trim(), mode: 'insensitive' },
          },
        },
      ];
    }

    const take = input.take ?? 50;
    const skip = input.skip ?? 0;

    let items = await this.prisma.salesOrder.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: input.hasBackorder ? undefined : take,
    });

    if (input.hasBackorder) {
      items = items.filter((o) =>
        o.lines.some((l) => toNumber(l.qtyBackordered) > 0),
      );
      items = items.slice(skip, skip + take);
    }

    const total = input.hasBackorder
      ? items.length
      : await this.prisma.salesOrder.count({ where });

    return {
      items: items.map((o) => this.mapOrder(o)),
      total,
    };
  }

  async allocate(orderId: string, actorId?: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (
      order.status === SalesOrderStatus.SHIPPED ||
      order.status === SalesOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot allocate order in status ${order.status}`,
      );
    }

    const updatedLines: Array<{
      id: string;
      qtyAllocated: number;
      qtyBackordered: number;
      allocationDetails: AllocationDetail[];
    }> = [];

    for (const line of order.lines) {
      if (line.toProduce || line.kind === SalesOrderLineKind.FABRICATED) {
        updatedLines.push({
          id: line.id,
          qtyAllocated: 0,
          qtyBackordered: 0,
          allocationDetails: [],
        });
        continue;
      }

      if (!line.productId) {
        throw new BadRequestException(
          `PRODUCT line ${line.lineNumber} missing productId`,
        );
      }

      const qtyOrdered = toNumber(line.qtyOrdered);
      const qtyAllocated = toNumber(line.qtyAllocated);
      const qtyShipped = toNumber(line.qtyShipped);
      const remainingNeeded = qtyOrdered - qtyAllocated - qtyShipped;

      if (remainingNeeded <= 0) {
        updatedLines.push({
          id: line.id,
          qtyAllocated,
          qtyBackordered: toNumber(line.qtyBackordered),
          allocationDetails:
            (line.allocationDetails as AllocationDetail[]) ?? [],
        });
        continue;
      }

      const lookup = await this.inventoryService.lookupByProduct({
        productId: line.productId,
      });

      const plan = greedyAllocate(
        remainingNeeded,
        lookup.items.map((item) => ({
          binId: item.binId,
          binCode: item.bin?.code,
          available: item.available,
        })),
      );

      const existingDetails =
        (line.allocationDetails as AllocationDetail[]) ?? [];
      const allocationDetails = [...existingDetails];

      for (const alloc of plan.allocations) {
        await this.inventoryService.allocate(
          {
            productId: line.productId,
            binId: alloc.binId,
            quantity: alloc.quantity,
          },
          actorId,
        );
        const existing = allocationDetails.find((d) => d.binId === alloc.binId);
        if (existing) {
          existing.quantity += alloc.quantity;
        } else {
          allocationDetails.push(alloc);
        }
      }

      const newAllocated = qtyAllocated + plan.allocated;
      const newBackordered = plan.backordered;

      updatedLines.push({
        id: line.id,
        qtyAllocated: newAllocated,
        qtyBackordered: newBackordered,
        allocationDetails,
      });
    }

    for (const ul of updatedLines) {
      await this.prisma.salesOrderLine.update({
        where: { id: ul.id },
        data: {
          qtyAllocated: ul.qtyAllocated,
          qtyBackordered: ul.qtyBackordered,
          allocationDetails: ul.allocationDetails as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const refreshed = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!refreshed) throw new NotFoundException(`Order ${orderId} not found`);

    const lineViews = refreshed.lines.map((l) => ({
      qtyOrdered: toNumber(l.qtyOrdered),
      qtyShipped: toNumber(l.qtyShipped),
      qtyBackordered: toNumber(l.qtyBackordered),
      toProduce: l.toProduce,
    }));

    const newStatus = deriveOrderStatus(lineViews, refreshed.status);
    const hasBackorder = refreshed.lines.some(
      (l) => toNumber(l.qtyBackordered) > 0,
    );

    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        status:
          newStatus === 'PARTIALLY_SHIPPED' || newStatus === 'SHIPPED'
            ? refreshed.status
            : hasBackorder
              ? SalesOrderStatus.BACKORDERED
              : SalesOrderStatus.ALLOCATED,
      },
    });

    const full = await this.getById(orderId);

    await this.eventBus.publish(SALES_EVENTS.order.allocated, {
      entityId: orderId,
      actorId,
      payload: {
        orderId,
        orderNumber: full.orderNumber,
        lines: full.lines.map((l) => ({
          lineId: l.id,
          qtyAllocated: l.qtyAllocated,
          qtyBackordered: l.qtyBackordered,
        })),
      },
    });

    if (hasBackorder) {
      await this.eventBus.publish(SALES_EVENTS.order.backordered, {
        entityId: orderId,
        actorId,
        payload: {
          orderId,
          orderNumber: full.orderNumber,
          lines: full.lines
            .filter((l) => l.qtyBackordered > 0)
            .map((l) => ({
              lineId: l.id,
              description: l.description,
              qtyBackordered: l.qtyBackordered,
            })),
        },
      });
    }

    return full;
  }

  async confirmShipment(input: ConfirmShipmentInput, actorId?: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: input.orderId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException(`Order ${input.orderId} not found`);

    if (
      order.status === SalesOrderStatus.CANCELLED ||
      order.status === SalesOrderStatus.SHIPPED
    ) {
      throw new BadRequestException(
        `Cannot ship order in status ${order.status}`,
      );
    }

    const shipmentLines: Array<{
      lineId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      binId?: string;
    }> = [];

    for (const shipLine of input.lines) {
      const line = order.lines.find((l) => l.id === shipLine.lineId);
      if (!line) {
        throw new NotFoundException(`Line ${shipLine.lineId} not found`);
      }

      const maxQty = maxShippableQty({
        kind: line.kind,
        qtyOrdered: toNumber(line.qtyOrdered),
        qtyAllocated: toNumber(line.qtyAllocated),
        qtyShipped: toNumber(line.qtyShipped),
        toProduce: line.toProduce,
      });

      if (shipLine.quantity > maxQty) {
        throw new BadRequestException(
          `Cannot ship ${shipLine.quantity} on line ${line.lineNumber} (max ${maxQty})`,
        );
      }

      if (
        line.kind === SalesOrderLineKind.PRODUCT &&
        !line.toProduce &&
        line.productId
      ) {
        const details =
          (line.allocationDetails as AllocationDetail[] | null) ?? [];
        let remaining = shipLine.quantity;

        if (shipLine.binId) {
          await this.inventoryService.ship(
            {
              productId: line.productId,
              binId: shipLine.binId,
              quantity: shipLine.quantity,
            },
            actorId,
          );
        } else if (details.length > 0) {
          for (const detail of details) {
            if (remaining <= 0) break;
            const shipQty = Math.min(remaining, detail.quantity);
            if (shipQty <= 0) continue;
            await this.inventoryService.ship(
              {
                productId: line.productId,
                binId: detail.binId,
                quantity: shipQty,
              },
              actorId,
            );
            remaining -= shipQty;
          }
          if (remaining > 0) {
            throw new BadRequestException(
              `Insufficient allocated bins to ship line ${line.lineNumber}`,
            );
          }
        } else {
          throw new BadRequestException(
            `binId required for PRODUCT line ${line.lineNumber}`,
          );
        }
      }

      const newShipped = toNumber(line.qtyShipped) + shipLine.quantity;
      await this.prisma.salesOrderLine.update({
        where: { id: line.id },
        data: { qtyShipped: newShipped },
      });

      shipmentLines.push({
        lineId: line.id,
        description: line.description,
        quantity: shipLine.quantity,
        unitPrice: toNumber(line.unitPrice),
        binId: shipLine.binId,
      });
    }

    const shipmentNumber = await this.nextShipmentNumber(input.orderId);
    const invoiceLines = shipmentLines.map((sl) => ({
      description: sl.description,
      quantity: sl.quantity,
      unitPrice: sl.unitPrice,
    }));

    const issueDate = new Date();
    const dueDate = new Date(Date.now() + 30 * 86400000);
    const draftInvoice = await this.invoiceService.create(
      {
        customerId: order.customerId,
        issueDate,
        dueDate,
        lines: invoiceLines,
      },
      actorId,
    );
    const postedInvoice = await this.invoiceService.post(
      draftInvoice.id,
      actorId,
    );

    const shipment = await this.prisma.salesOrderShipment.create({
      data: {
        orderId: input.orderId,
        shipmentNumber,
        invoiceId: postedInvoice.id,
        lines: shipmentLines as unknown as Prisma.InputJsonValue,
      },
    });

    const refreshed = await this.prisma.salesOrder.findUnique({
      where: { id: input.orderId },
      include: { lines: true },
    });
    if (!refreshed) throw new NotFoundException(`Order ${input.orderId} not found`);

    const lineViews = refreshed.lines.map((l) => ({
      qtyOrdered: toNumber(l.qtyOrdered),
      qtyShipped: toNumber(l.qtyShipped),
      qtyBackordered: toNumber(l.qtyBackordered),
      toProduce: l.toProduce,
    }));
    const newStatus = deriveOrderStatus(lineViews, refreshed.status);

    await this.prisma.salesOrder.update({
      where: { id: input.orderId },
      data: {
        status:
          newStatus === 'SHIPPED'
            ? SalesOrderStatus.SHIPPED
            : SalesOrderStatus.PARTIALLY_SHIPPED,
      },
    });

    await this.audit.record({
      actorId,
      action: 'ship',
      entityType: 'SalesOrder',
      entityId: input.orderId,
      metadata: { shipmentNumber, invoiceId: postedInvoice.id },
    });

    await this.eventBus.publish(SALES_EVENTS.order.shipped, {
      entityId: input.orderId,
      actorId,
      payload: {
        orderId: input.orderId,
        orderNumber: order.orderNumber,
        shipmentId: shipment.id,
        invoiceId: postedInvoice.id,
        invoiceNumber: postedInvoice.invoiceNumber,
        shippedLines: shipmentLines,
      },
    });

    return this.getById(input.orderId);
  }

  async cancel(orderId: string, actorId?: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (
      order.status === SalesOrderStatus.SHIPPED ||
      order.status === SalesOrderStatus.PARTIALLY_SHIPPED
    ) {
      throw new BadRequestException('Cannot cancel a shipped order');
    }
    if (order.status === SalesOrderStatus.CANCELLED) {
      return this.getById(orderId);
    }

    for (const line of order.lines) {
      if (line.productId && line.allocationDetails) {
        await this.deallocateLineDetails(
          line.productId,
          line.allocationDetails as AllocationDetail[],
          actorId,
        );
      }
    }

    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: { status: SalesOrderStatus.CANCELLED },
    });

    await this.audit.record({
      actorId,
      action: 'cancel',
      entityType: 'SalesOrder',
      entityId: orderId,
      metadata: { orderNumber: order.orderNumber },
    });

    return this.getById(orderId);
  }

  private async deallocateLineDetails(
    productId: string,
    details: AllocationDetail[],
    actorId?: string,
  ) {
    for (const detail of details) {
      if (detail.quantity <= 0) continue;
      await this.inventoryService.deallocate(
        {
          productId,
          binId: detail.binId,
          quantity: detail.quantity,
        },
        actorId,
      );
    }
  }

  private mapOrder(order: {
    id: string;
    orderNumber: string;
    quoteId: string | null;
    customerId: string;
    status: SalesOrderStatus;
    requestedShipDate: Date | null;
    currency: string;
    notes: string | null;
    subtotal: Prisma.Decimal;
    total: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    customer?: { id: string; name: string };
    quote?: { id: string; quoteNumber: string } | null;
    lines?: Array<{
      id: string;
      lineNumber: number;
      kind: SalesOrderLineKind;
      productId: string | null;
      description: string;
      unitPrice: Prisma.Decimal;
      qtyOrdered: Prisma.Decimal;
      qtyAllocated: Prisma.Decimal;
      qtyShipped: Prisma.Decimal;
      qtyBackordered: Prisma.Decimal;
      toProduce: boolean;
      lineTotal: Prisma.Decimal;
      allocationDetails?: unknown;
      product?: { id: string; sku: string; description: string } | null;
    }>;
    shipments?: Array<{
      id: string;
      shipmentNumber: string;
      invoiceId: string | null;
      shippedAt: Date;
      lines: unknown;
    }>;
  }) {
    return {
      ...order,
      subtotal: toNumber(order.subtotal),
      total: toNumber(order.total),
      lines: (order.lines ?? []).map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        kind: l.kind,
        productId: l.productId,
        description: l.description,
        unitPrice: toNumber(l.unitPrice),
        qtyOrdered: toNumber(l.qtyOrdered),
        qtyAllocated: toNumber(l.qtyAllocated),
        qtyShipped: toNumber(l.qtyShipped),
        qtyBackordered: toNumber(l.qtyBackordered),
        toProduce: l.toProduce,
        lineTotal: toNumber(l.lineTotal),
        allocationDetails: l.allocationDetails ?? null,
        product: l.product ?? null,
      })),
      shipments: (order.shipments ?? []).map((s) => ({
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        invoiceId: s.invoiceId,
        shippedAt: s.shippedAt,
        lines: s.lines,
      })),
    };
  }

  private async nextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;
    const latest = await this.prisma.salesOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });
    const seq = latest
      ? Number(latest.orderNumber.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async nextShipmentNumber(orderId: string): Promise<string> {
    const count = await this.prisma.salesOrderShipment.count({
      where: { orderId },
    });
    return `SHP-${String(count + 1).padStart(3, '0')}`;
  }
}

