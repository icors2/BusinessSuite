import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RmaStatus } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { CreditMemoService } from 'finance';
import { EVENT_BUS, EventBus } from 'event-bus';
import { QmsService } from 'qms';
import { InventoryService, LocationService } from 'wms';
import { RETURNS_EVENTS } from './events';
import { formatRmaNumber, parseRmaSequence } from './rma-number';
import {
  getReturnWindowDays,
  isWithinReturnWindow,
  maxReturnableQty,
} from './return-window';
import {
  ApproveRmaInput,
  GetRmaInput,
  ListRmasInput,
  ReceiveRmaInput,
  RejectRmaInput,
  RequestRmaInput,
  ResolveRmaInput,
} from './schemas';

const ACTIVE_RMA_STATUSES: RmaStatus[] = [
  'REQUESTED',
  'APPROVED',
  'RECEIVED',
  'RESOLVED',
];

const rmaInclude = {
  salesOrder: { select: { id: true, orderNumber: true, status: true } },
  salesOrderLine: {
    select: {
      id: true,
      lineNumber: true,
      description: true,
      productId: true,
      unitPrice: true,
      qtyShipped: true,
    },
  },
  customer: { select: { id: true, name: true, email: true } },
  nonConformance: {
    select: { id: true, ncNumber: true, severity: true, status: true },
  },
  returnedBin: { select: { id: true, code: true } },
  creditMemo: {
    select: {
      id: true,
      creditMemoNumber: true,
      status: true,
      total: true,
    },
  },
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

interface ShipmentLineSnapshot {
  lineId?: string;
  quantity?: number;
}

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly locationService: LocationService,
    private readonly qmsService: QmsService,
    private readonly creditMemoService: CreditMemoService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async requestRma(input: RequestRmaInput, actorId?: string) {
    if (!actorId) {
      throw new BadRequestException('User id is required');
    }

    const line = await this.prisma.salesOrderLine.findUnique({
      where: { id: input.salesOrderLineId },
      include: {
        order: {
          include: {
            shipments: { orderBy: { shippedAt: 'desc' } },
          },
        },
      },
    });

    if (!line) {
      throw new NotFoundException('Sales order line not found');
    }

    const qtyShipped = toNumber(line.qtyShipped);
    if (qtyShipped <= 0) {
      throw new BadRequestException(
        'RMA can only be requested against shipped order lines',
      );
    }

    const existingReturns = await this.prisma.rma.aggregate({
      where: {
        salesOrderLineId: line.id,
        status: { in: ACTIVE_RMA_STATUSES },
      },
      _sum: { quantity: true },
    });
    const qtyAlreadyReturned = toNumber(existingReturns._sum.quantity);
    const maxQty = maxReturnableQty(qtyShipped, qtyAlreadyReturned);

    if (input.quantity > maxQty) {
      throw new BadRequestException(
        `Return quantity ${input.quantity} exceeds returnable quantity ${maxQty}`,
      );
    }

    const shippedAt = this.findLineShippedAt(line.order.shipments, line.id);
    if (!shippedAt) {
      throw new BadRequestException(
        'No shipment record found for this order line',
      );
    }

    if (!isWithinReturnWindow(shippedAt, new Date(), getReturnWindowDays())) {
      throw new BadRequestException(
        `Return window of ${getReturnWindowDays()} days has expired for this line`,
      );
    }

    const rmaNumber = await this.nextRmaNumber();
    const rma = await this.prisma.rma.create({
      data: {
        rmaNumber,
        salesOrderId: line.orderId,
        salesOrderLineId: line.id,
        customerId: line.order.customerId,
        reasonCode: input.reasonCode,
        quantity: input.quantity,
        qualityRelated: input.qualityRelated ?? false,
        notes: input.notes,
        requestedByUserId: actorId,
      },
      include: rmaInclude,
    });

    await this.audit.record({
      actorId,
      action: 'returns.rma.requested',
      entityType: 'Rma',
      entityId: rma.id,
      metadata: { rmaNumber, salesOrderLineId: line.id },
    });

    await this.eventBus.publish(RETURNS_EVENTS.rma.requested, {
      entityId: rma.id,
      actorId,
      payload: {
        rmaId: rma.id,
        rmaNumber: rma.rmaNumber,
        salesOrderId: rma.salesOrderId,
        customerId: rma.customerId,
        salesOrderLineId: rma.salesOrderLineId,
        quantity: input.quantity,
      },
    });

    return rma;
  }

  async approveRma(input: ApproveRmaInput, actorId?: string) {
    const rma = await this.getRmaEntity(input.id);
    if (rma.status !== 'REQUESTED') {
      throw new BadRequestException('Only REQUESTED RMAs can be approved');
    }

    return this.prisma.rma.update({
      where: { id: input.id },
      data: {
        status: 'APPROVED',
        approvedByUserId: actorId,
        approvedAt: new Date(),
        notes: input.notes ?? rma.notes,
      },
      include: rmaInclude,
    });
  }

  async rejectRma(input: RejectRmaInput, actorId?: string) {
    const rma = await this.getRmaEntity(input.id);
    if (rma.status !== 'REQUESTED' && rma.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only REQUESTED or APPROVED RMAs can be rejected',
      );
    }

    return this.prisma.rma.update({
      where: { id: input.id },
      data: {
        status: 'REJECTED',
        resolvedByUserId: actorId,
        resolvedAt: new Date(),
        notes: input.notes ?? rma.notes,
      },
      include: rmaInclude,
    });
  }

  async receiveRma(input: ReceiveRmaInput, actorId?: string) {
    if (!actorId) {
      throw new BadRequestException('User id is required');
    }

    const rma = await this.getRmaEntity(input.id);
    if (rma.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED RMAs can be received');
    }

    const binCode = input.binCode ?? 'RET-01';
    const bin = input.binId
      ? await this.prisma.bin.findUnique({ where: { id: input.binId } })
      : await this.locationService.getBinByCode(binCode);

    if (!bin) {
      throw new NotFoundException('Returns bin not found');
    }

    const productId = rma.salesOrderLine.productId;
    if (!productId) {
      throw new BadRequestException(
        'Cannot receive return for a line without a product',
      );
    }

    await this.inventoryService.receive(
      {
        productId,
        binId: bin.id,
        quantity: toNumber(rma.quantity),
        note: `RMA ${rma.rmaNumber} return receipt`,
      },
      actorId,
    );

    let nonConformanceId: string | undefined;
    if (rma.qualityRelated) {
      const nc = await this.qmsService.raiseReturnNonConformance(
        {
          description: `Quality return — RMA ${rma.rmaNumber}: ${rma.notes ?? rma.reasonCode}`,
          severity: 'MAJOR',
          productId,
          binId: bin.id,
          quantityScrapped: toNumber(rma.quantity),
        },
        actorId,
      );
      nonConformanceId = nc.id;
    }

    const updated = await this.prisma.rma.update({
      where: { id: rma.id },
      data: {
        status: 'RECEIVED',
        returnedBinId: bin.id,
        nonConformanceId,
        receivedByUserId: actorId,
        receivedAt: new Date(),
        notes: input.notes ?? rma.notes,
      },
      include: rmaInclude,
    });

    await this.audit.record({
      actorId,
      action: 'returns.rma.received',
      entityType: 'Rma',
      entityId: updated.id,
      metadata: { rmaNumber: updated.rmaNumber, binId: bin.id },
    });

    await this.eventBus.publish(RETURNS_EVENTS.rma.received, {
      entityId: updated.id,
      actorId,
      payload: {
        rmaId: updated.id,
        rmaNumber: updated.rmaNumber,
        salesOrderId: updated.salesOrderId,
        returnedBinId: bin.id,
        nonConformanceId,
        qualityRelated: updated.qualityRelated,
      },
    });

    return updated;
  }

  async resolveRma(input: ResolveRmaInput, actorId?: string) {
    if (!actorId) {
      throw new BadRequestException('User id is required');
    }

    const rma = await this.getRmaEntity(input.id);
    if (rma.status !== 'RECEIVED') {
      throw new BadRequestException('Only RECEIVED RMAs can be resolved');
    }

    let creditMemoId: string | undefined;

    if (input.resolutionType === 'REFUND') {
      const unitPrice = toNumber(rma.salesOrderLine.unitPrice);
      const quantity = toNumber(rma.quantity);
      const creditMemo = await this.creditMemoService.create(
        {
          customerId: rma.customerId,
          issueDate: new Date(),
          notes: `Refund for RMA ${rma.rmaNumber}`,
          lines: [
            {
              description: `Return credit — ${rma.salesOrderLine.description}`,
              quantity,
              unitPrice,
            },
          ],
        },
        actorId,
      );
      const posted = await this.creditMemoService.post(creditMemo.id, actorId);
      creditMemoId = posted.id;
    }

    const updated = await this.prisma.rma.update({
      where: { id: rma.id },
      data: {
        status: 'RESOLVED',
        resolutionType: input.resolutionType,
        creditMemoId,
        resolvedByUserId: actorId,
        resolvedAt: new Date(),
        notes: input.notes ?? rma.notes,
      },
      include: rmaInclude,
    });

    await this.audit.record({
      actorId,
      action: 'returns.rma.resolved',
      entityType: 'Rma',
      entityId: updated.id,
      metadata: {
        rmaNumber: updated.rmaNumber,
        resolutionType: input.resolutionType,
        creditMemoId,
      },
    });

    await this.eventBus.publish(RETURNS_EVENTS.rma.resolved, {
      entityId: updated.id,
      actorId,
      payload: {
        rmaId: updated.id,
        rmaNumber: updated.rmaNumber,
        resolutionType: input.resolutionType,
        creditMemoId,
      },
    });

    return updated;
  }

  async listRmas(input: ListRmasInput = {}) {
    const where: Prisma.RmaWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.customerId) where.customerId = input.customerId;
    if (input.salesOrderId) where.salesOrderId = input.salesOrderId;

    const [items, total] = await Promise.all([
      this.prisma.rma.findMany({
        where,
        include: rmaInclude,
        orderBy: { requestedAt: 'desc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.rma.count({ where }),
    ]);

    return { items, total };
  }

  async getRma(input: GetRmaInput) {
    if (!input.id && !input.rmaNumber) {
      throw new BadRequestException('RMA id or rmaNumber is required');
    }

    const rma = await this.prisma.rma.findFirst({
      where: input.id ? { id: input.id } : { rmaNumber: input.rmaNumber },
      include: rmaInclude,
    });

    if (!rma) {
      throw new NotFoundException('RMA not found');
    }

    return rma;
  }

  private async getRmaEntity(id: string) {
    const rma = await this.prisma.rma.findUnique({
      where: { id },
      include: rmaInclude,
    });
    if (!rma) {
      throw new NotFoundException('RMA not found');
    }
    return rma;
  }

  private findLineShippedAt(
    shipments: Array<{ shippedAt: Date; lines: unknown }>,
    lineId: string,
  ): Date | null {
    for (const shipment of shipments) {
      const lines = shipment.lines as ShipmentLineSnapshot[];
      if (!Array.isArray(lines)) continue;
      const match = lines.find((l) => l.lineId === lineId);
      if (match) {
        return shipment.shippedAt;
      }
    }
    return null;
  }

  private async nextRmaNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `RMA-${year}-`;
    const existing = await this.prisma.rma.findMany({
      where: { rmaNumber: { startsWith: prefix } },
      select: { rmaNumber: true },
    });

    let maxSeq = 0;
    for (const row of existing) {
      const parsed = parseRmaSequence(row.rmaNumber, year);
      if (parsed != null && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }

    return formatRmaNumber(year, maxSeq + 1);
  }
}
