import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MpsStrategy,
  Prisma,
  SalesOrderStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { InventoryService } from 'wms';
import {
  aggregateDemand,
  OpenDemandLine,
} from './aggregation';
import { calculateNetDemand } from './net-demand';
import { MPS_EVENTS } from './events';
import { proposeSchedule } from './scheduling';
import {
  GenerateScheduleInput,
  GetCalendarInput,
  ListWorkOrdersInput,
  PreviewDemandInput,
  RescheduleWorkOrderInput,
  SetProductStrategyInput,
  SetStrategyInput,
  UpsertCalendarDayInput,
  UpsertLineInput,
} from './schemas';

const workOrderInclude = {
  product: true,
  line: true,
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return value.toNumber();
}

function defaultHorizon(): { start: Date; end: Date } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 3);
  return { start, end };
}

@Injectable()
export class MpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventoryService: InventoryService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async previewDemand(input: PreviewDemandInput = {}) {
    const { start, end } = this.resolveHorizon(input);
    const demandLines = await this.fetchOpenDemand();
    const strategyMap = await this.loadStrategyMap();
    const resolveStrategy = (line: OpenDemandLine) =>
      this.resolveStrategyForLine(line, strategyMap);

    const { buckets, skipped } = aggregateDemand(
      demandLines,
      resolveStrategy,
      start,
      end,
    );

    const inventoryByProduct = await this.loadInventoryMap(
      buckets.map((b) => b.productId),
    );
    const scheduledByProductPeriod = await this.loadScheduledMap();
    const netBuckets = calculateNetDemand(
      buckets,
      inventoryByProduct,
      scheduledByProductPeriod,
    );

    return {
      horizonStart: start,
      horizonEnd: end,
      grossBuckets: buckets,
      netBuckets,
      skipped,
      summary: {
        grossLines: buckets.length,
        netWorkOrdersNeeded: netBuckets.filter((b) => b.netQty > 0).length,
        skippedCount: skipped.length,
      },
    };
  }

  async generateSchedule(input: GenerateScheduleInput, actorId?: string) {
    const preview = await this.previewDemand(input);
    const lines = await this.prisma.productionLine.findMany({
      where: { active: true },
    });
    if (lines.length === 0) {
      throw new BadRequestException(
        'At least one active production line is required',
      );
    }

    const calendarDays = await this.prisma.factoryCalendarDay.findMany({
      where: {
        date: {
          gte: preview.horizonStart,
          lte: preview.horizonEnd,
        },
      },
    });

    const { workOrders: proposed, capacity, overloads } = proposeSchedule(
      preview.netBuckets,
      lines.map((l) => ({
        id: l.id,
        code: l.code,
        capacityPerDay: toNumber(l.capacityPerDay),
        active: l.active,
      })),
      calendarDays.map((d) => ({ date: d.date, isWorkingDay: d.isWorkingDay })),
    );

    if (input.replaceExisting) {
      await this.prisma.workOrder.deleteMany({
        where: {
          status: WorkOrderStatus.PROPOSED,
          scheduledStart: {
            gte: preview.horizonStart,
            lte: preview.horizonEnd,
          },
        },
      });
    }

    const created = [];
    for (const proposal of proposed) {
      const woNumber = await this.nextWoNumber();
      const wo = await this.prisma.workOrder.create({
        data: {
          woNumber,
          productId: proposal.productId,
          lineId: proposal.lineId,
          quantity: proposal.quantity,
          scheduledStart: proposal.scheduledStart,
          scheduledEnd: proposal.scheduledEnd,
          status: WorkOrderStatus.PROPOSED,
          strategy: proposal.strategy,
          periodKey: proposal.periodKey,
          demandRefs: proposal.demandRefs,
        },
        include: workOrderInclude,
      });
      created.push(this.mapWorkOrder(wo));

      await this.eventBus.publish(MPS_EVENTS.workorder.scheduled, {
        entityId: wo.id,
        actorId,
        payload: {
          workOrderId: wo.id,
          woNumber: wo.woNumber,
          productId: wo.productId,
          quantity: toNumber(wo.quantity),
          periodKey: wo.periodKey,
          lineId: wo.lineId,
        },
      });

      await this.audit.record({
        actorId,
        action: 'mps.workorder.scheduled',
        entityType: 'WorkOrder',
        entityId: wo.id,
        metadata: { woNumber, periodKey: wo.periodKey },
      });
    }

    for (const overload of overloads) {
      await this.eventBus.publish(MPS_EVENTS.capacity.overloaded, {
        entityId: `${overload.periodKey}:${overload.lineId}`,
        actorId,
        payload: { ...overload },
      });
    }

    return {
      created,
      capacity,
      overloads,
      preview: preview.summary,
    };
  }

  async listWorkOrders(input: ListWorkOrdersInput) {
    const where: Prisma.WorkOrderWhereInput = {};
    if (input.status) {
      where.status = input.status;
    }
    if (input.productId) {
      where.productId = input.productId;
    }
    if (input.periodKey) {
      where.periodKey = input.periodKey;
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: workOrderInclude,
        orderBy: { scheduledStart: 'asc' },
        skip: input.skip ?? 0,
        take: input.take ?? 50,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return {
      items: items.map((wo) => this.mapWorkOrder(wo)),
      total,
    };
  }

  async getWorkOrder(workOrderId: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: workOrderInclude,
    });
    if (!wo) {
      throw new NotFoundException(`Work order ${workOrderId} not found`);
    }
    return this.mapWorkOrder(wo);
  }

  async rescheduleWorkOrder(
    input: RescheduleWorkOrderInput,
    actorId?: string,
  ) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
    });
    if (!wo) {
      throw new NotFoundException(`Work order ${input.workOrderId} not found`);
    }
    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot reschedule work order in status ${wo.status}`,
      );
    }
    if (input.scheduledEnd < input.scheduledStart) {
      throw new BadRequestException('scheduledEnd must be on or after scheduledStart');
    }

    const previousStart = wo.scheduledStart;
    const previousEnd = wo.scheduledEnd;

    const updated = await this.prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        lineId: input.lineId ?? wo.lineId,
        status:
          wo.status === WorkOrderStatus.PROPOSED
            ? WorkOrderStatus.FIRM
            : wo.status,
      },
      include: workOrderInclude,
    });

    await this.eventBus.publish(MPS_EVENTS.workorder.rescheduled, {
      entityId: updated.id,
      actorId,
      payload: {
        workOrderId: updated.id,
        woNumber: updated.woNumber,
        previousStart,
        previousEnd,
        scheduledStart: updated.scheduledStart,
        scheduledEnd: updated.scheduledEnd,
        lineId: updated.lineId,
      },
    });

    await this.audit.record({
      actorId,
      action: 'mps.workorder.rescheduled',
      entityType: 'WorkOrder',
      entityId: updated.id,
      metadata: {
        woNumber: updated.woNumber,
        previousStart,
        previousEnd,
      },
    });

    return this.mapWorkOrder(updated);
  }

  async upsertLine(input: UpsertLineInput, actorId?: string) {
    const data = {
      code: input.code,
      name: input.name,
      capacityPerDay: input.capacityPerDay,
      active: input.active ?? true,
    };

    const line = input.id
      ? await this.prisma.productionLine.update({
          where: { id: input.id },
          data,
        })
      : await this.prisma.productionLine.upsert({
          where: { code: input.code },
          create: data,
          update: data,
        });

    await this.audit.record({
      actorId,
      action: input.id ? 'mps.line.updated' : 'mps.line.created',
      entityType: 'ProductionLine',
      entityId: line.id,
      metadata: { code: line.code },
    });

    return {
      id: line.id,
      code: line.code,
      name: line.name,
      capacityPerDay: toNumber(line.capacityPerDay),
      active: line.active,
    };
  }

  async listLines() {
    const lines = await this.prisma.productionLine.findMany({
      orderBy: { code: 'asc' },
    });
    return lines.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      capacityPerDay: toNumber(l.capacityPerDay),
      active: l.active,
    }));
  }

  async upsertCalendarDay(input: UpsertCalendarDayInput, actorId?: string) {
    const dateOnly = new Date(
      Date.UTC(
        input.date.getUTCFullYear(),
        input.date.getUTCMonth(),
        input.date.getUTCDate(),
      ),
    );

    const day = await this.prisma.factoryCalendarDay.upsert({
      where: { date: dateOnly },
      create: {
        date: dateOnly,
        isWorkingDay: input.isWorkingDay,
        notes: input.notes,
      },
      update: {
        isWorkingDay: input.isWorkingDay,
        notes: input.notes,
      },
    });

    await this.audit.record({
      actorId,
      action: 'mps.calendar.upserted',
      entityType: 'FactoryCalendarDay',
      entityId: day.id,
      metadata: { date: dateOnly.toISOString().slice(0, 10) },
    });

    return {
      id: day.id,
      date: day.date,
      isWorkingDay: day.isWorkingDay,
      notes: day.notes,
    };
  }

  async getCalendar(input: GetCalendarInput) {
    const days = await this.prisma.factoryCalendarDay.findMany({
      where: {
        date: { gte: input.start, lte: input.end },
      },
      orderBy: { date: 'asc' },
    });
    return days.map((d) => ({
      id: d.id,
      date: d.date,
      isWorkingDay: d.isWorkingDay,
      notes: d.notes,
    }));
  }

  async setStrategy(input: SetStrategyInput, actorId?: string) {
    const setting = await this.prisma.mpsSetting.upsert({
      where: { scope: input.scope },
      create: { scope: input.scope, strategy: input.strategy },
      update: { strategy: input.strategy },
    });

    await this.audit.record({
      actorId,
      action: 'mps.strategy.set',
      entityType: 'MpsSetting',
      entityId: setting.id,
      metadata: { scope: input.scope, strategy: input.strategy },
    });

    return setting;
  }

  async setProductStrategy(input: SetProductStrategyInput, actorId?: string) {
    const product = await this.prisma.product.update({
      where: { id: input.productId },
      data: { mpsStrategy: input.strategy },
    });

    await this.audit.record({
      actorId,
      action: 'mps.product.strategy.set',
      entityType: 'Product',
      entityId: product.id,
      metadata: { strategy: input.strategy },
    });

    return {
      id: product.id,
      sku: product.sku,
      mpsStrategy: product.mpsStrategy,
    };
  }

  async listSettings() {
    return this.prisma.mpsSetting.findMany({ orderBy: { scope: 'asc' } });
  }

  private resolveHorizon(input: PreviewDemandInput | GenerateScheduleInput) {
    const defaults = defaultHorizon();
    return {
      start: input.horizonStart ?? defaults.start,
      end: input.horizonEnd ?? defaults.end,
    };
  }

  private async fetchOpenDemand(): Promise<OpenDemandLine[]> {
    const lines = await this.prisma.salesOrderLine.findMany({
      where: {
        productId: { not: null },
        order: {
          status: {
            notIn: [SalesOrderStatus.CANCELLED, SalesOrderStatus.SHIPPED],
          },
        },
      },
      include: {
        product: true,
        order: { select: { orderNumber: true, requestedShipDate: true } },
      },
    });

    return lines
      .map((line) => {
        const qty =
          toNumber(line.qtyOrdered) - toNumber(line.qtyShipped);
        if (qty <= 0 || !line.productId || !line.product) {
          return null;
        }
        return {
          salesOrderLineId: line.id,
          salesOrderId: line.orderId,
          orderNumber: line.order.orderNumber,
          productId: line.productId,
          productSku: line.product.sku,
          category: line.product.category,
          mpsStrategy: line.product.mpsStrategy,
          qty,
          requestedShipDate: line.order.requestedShipDate,
        } satisfies OpenDemandLine;
      })
      .filter((l): l is OpenDemandLine => l !== null);
  }

  private async loadStrategyMap(): Promise<Map<string, MpsStrategy>> {
    const settings = await this.prisma.mpsSetting.findMany();
    const map = new Map<string, MpsStrategy>();
    for (const s of settings) {
      map.set(s.scope, s.strategy);
    }
    return map;
  }

  private resolveStrategyForLine(
    line: OpenDemandLine,
    strategyMap: Map<string, MpsStrategy>,
  ): MpsStrategy {
    if (line.mpsStrategy) {
      return line.mpsStrategy;
    }
    if (line.category && strategyMap.has(line.category)) {
      return strategyMap.get(line.category)!;
    }
    if (strategyMap.has('GLOBAL')) {
      return strategyMap.get('GLOBAL')!;
    }
    return MpsStrategy.WEEKLY;
  }

  private async loadInventoryMap(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const unique = [...new Set(productIds)];
    const map = new Map<string, number>();
    for (const productId of unique) {
      try {
        const lookup = await this.inventoryService.lookupByProduct({
          productId,
        });
        map.set(productId, lookup.totals.available);
      } catch {
        map.set(productId, 0);
      }
    }
    return map;
  }

  private async loadScheduledMap(): Promise<Map<string, number>> {
    const existing = await this.prisma.workOrder.findMany({
      where: {
        status: {
          notIn: [WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED],
        },
      },
      select: { productId: true, periodKey: true, quantity: true },
    });
    const map = new Map<string, number>();
    for (const wo of existing) {
      const key = `${wo.productId}:${wo.periodKey}`;
      map.set(key, (map.get(key) ?? 0) + toNumber(wo.quantity));
    }
    return map;
  }

  private async nextWoNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    const latest = await this.prisma.workOrder.findFirst({
      where: { woNumber: { startsWith: prefix } },
      orderBy: { woNumber: 'desc' },
    });
    const seq = latest
      ? Number(latest.woNumber.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private mapWorkOrder(
    wo: Prisma.WorkOrderGetPayload<{ include: typeof workOrderInclude }>,
  ) {
    return {
      id: wo.id,
      woNumber: wo.woNumber,
      productId: wo.productId,
      product: wo.product
        ? { id: wo.product.id, sku: wo.product.sku, description: wo.product.description }
        : null,
      lineId: wo.lineId,
      line: wo.line
        ? { id: wo.line.id, code: wo.line.code, name: wo.line.name }
        : null,
      quantity: toNumber(wo.quantity),
      scheduledStart: wo.scheduledStart,
      scheduledEnd: wo.scheduledEnd,
      status: wo.status,
      strategy: wo.strategy,
      periodKey: wo.periodKey,
      demandRefs: wo.demandRefs,
      createdAt: wo.createdAt,
      updatedAt: wo.updatedAt,
    };
  }
}
