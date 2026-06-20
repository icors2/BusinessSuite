import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenanceStatus,
  MaintenanceType,
  PmTriggerType,
  Prisma,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { CMMS_EVENTS } from './events';
import { formatMwoNumber, parseMwoSequence } from './mwo-number';
import {
  CancelMaintenanceWorkOrderInput,
  CompleteMaintenanceWorkOrderInput,
  CreateMaintenanceWorkOrderInput,
  GetAssetInput,
  GetDueSoonInput,
  GetMaintenanceHistoryForWorkOrderInput,
  GetMaintenanceWorkOrderInput,
  ListAssetsInput,
  ListMaintenanceWorkOrdersInput,
  ListPmRulesInput,
  StartMaintenanceWorkOrderInput,
  UpsertAssetInput,
  UpsertPmRuleInput,
} from './schemas';
import {
  isCalendarDueSoon,
  isCalendarOverdue,
  isCycleDueSoon,
  isCycleOverdue,
  isMwoDueSoon,
  isMwoOverdue,
  shouldTriggerCalendar,
  shouldTriggerCycle,
} from './triggers';

const OPEN_MWO_STATUSES: MaintenanceStatus[] = ['OPEN', 'IN_PROGRESS'];

const assetInclude = {
  workstation: { select: { id: true, code: true, name: true } },
  triggerRules: { where: { active: true }, orderBy: { createdAt: 'asc' as const } },
};

const mwoInclude = {
  asset: {
    select: { id: true, code: true, name: true, status: true },
  },
  triggerRule: {
    select: { id: true, type: true, thresholdCycles: true, intervalDays: true },
  },
};

@Injectable()
export class CmmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async upsertAsset(input: UpsertAssetInput, actorId?: string) {
    const asset = await this.prisma.asset.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        description: input.description,
        workstationId: input.workstationId ?? null,
        status: input.status ?? 'OPERATIONAL',
      },
      update: {
        name: input.name,
        description: input.description,
        workstationId: input.workstationId ?? null,
        status: input.status,
      },
      include: assetInclude,
    });

    await this.audit.record({
      actorId,
      action: 'cmms.asset.upserted',
      entityType: 'Asset',
      entityId: asset.id,
      metadata: { code: asset.code },
    });

    return asset;
  }

  async listAssets(input: ListAssetsInput = {}) {
    const where: Prisma.AssetWhereInput = {};
    if (input.workstationId) where.workstationId = input.workstationId;
    if (input.status) where.status = input.status;

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: assetInclude,
        orderBy: { code: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return { items, total };
  }

  async getAsset(input: GetAssetInput) {
    if (!input.id && !input.code) {
      throw new BadRequestException('Asset id or code is required');
    }

    const asset = await this.prisma.asset.findFirst({
      where: input.id ? { id: input.id } : { code: input.code },
      include: assetInclude,
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async upsertPmRule(input: UpsertPmRuleInput, actorId?: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: input.assetId },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (input.type === 'CYCLE_COUNT' && !input.thresholdCycles) {
      throw new BadRequestException('thresholdCycles is required for CYCLE_COUNT rules');
    }
    if (input.type === 'CALENDAR' && !input.intervalDays) {
      throw new BadRequestException('intervalDays is required for CALENDAR rules');
    }

    const rule = input.id
      ? await this.prisma.pmTriggerRule.update({
          where: { id: input.id },
          data: {
            type: input.type,
            thresholdCycles:
              input.type === 'CYCLE_COUNT' ? input.thresholdCycles : null,
            intervalDays: input.type === 'CALENDAR' ? input.intervalDays : null,
            active: input.active,
          },
        })
      : await this.prisma.pmTriggerRule.create({
          data: {
            assetId: input.assetId,
            type: input.type,
            thresholdCycles:
              input.type === 'CYCLE_COUNT' ? input.thresholdCycles : null,
            intervalDays: input.type === 'CALENDAR' ? input.intervalDays : null,
            active: input.active ?? true,
          },
        });

    await this.audit.record({
      actorId,
      action: 'cmms.pm_rule.upserted',
      entityType: 'PmTriggerRule',
      entityId: rule.id,
      metadata: { assetId: input.assetId, type: input.type },
    });

    return rule;
  }

  async listPmRules(input: ListPmRulesInput = {}) {
    const where: Prisma.PmTriggerRuleWhereInput = {};
    if (input.assetId) where.assetId = input.assetId;
    if (input.active != null) where.active = input.active;

    const [items, total] = await Promise.all([
      this.prisma.pmTriggerRule.findMany({
        where,
        include: { asset: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.pmTriggerRule.count({ where }),
    ]);

    return { items, total };
  }

  async createMaintenanceWorkOrder(
    input: CreateMaintenanceWorkOrderInput,
    actorId?: string,
    options?: { type?: MaintenanceType; triggerRuleId?: string },
  ) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: input.assetId },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const mwoNumber = await this.nextMwoNumber();
    const mwo = await this.prisma.maintenanceWorkOrder.create({
      data: {
        mwoNumber,
        assetId: input.assetId,
        triggerRuleId: options?.triggerRuleId,
        type: options?.type ?? 'CORRECTIVE',
        description: input.description,
        scheduledDate: input.scheduledDate,
        notes: input.notes,
      },
      include: mwoInclude,
    });

    await this.audit.record({
      actorId,
      action: 'cmms.workorder.created',
      entityType: 'MaintenanceWorkOrder',
      entityId: mwo.id,
      metadata: { mwoNumber, assetId: input.assetId },
    });

    await this.eventBus.publish(CMMS_EVENTS.workorder.created, {
      entityId: mwo.id,
      actorId,
      payload: {
        mwoId: mwo.id,
        mwoNumber: mwo.mwoNumber,
        assetId: mwo.assetId,
        type: mwo.type,
        triggerRuleId: mwo.triggerRuleId,
      },
    });

    return mwo;
  }

  async listMaintenanceWorkOrders(input: ListMaintenanceWorkOrdersInput = {}) {
    const where: Prisma.MaintenanceWorkOrderWhereInput = {};
    if (input.assetId) where.assetId = input.assetId;
    if (input.status) where.status = input.status;
    if (input.type) where.type = input.type;

    let items = await this.prisma.maintenanceWorkOrder.findMany({
      where,
      include: mwoInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: input.skip,
      take: input.take ?? 50,
    });

    if (input.dueSoonOnly) {
      const now = new Date();
      items = items.filter(
        (mwo) =>
          isMwoDueSoon(mwo.status, mwo.scheduledDate, now) ||
          isMwoOverdue(mwo.status, mwo.scheduledDate, now),
      );
    }

    const total = input.dueSoonOnly ? items.length : await this.prisma.maintenanceWorkOrder.count({ where });

    return { items, total };
  }

  async getMaintenanceWorkOrder(input: GetMaintenanceWorkOrderInput) {
    if (!input.id && !input.mwoNumber) {
      throw new BadRequestException('Maintenance work order id or mwoNumber is required');
    }

    const mwo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: input.id ? { id: input.id } : { mwoNumber: input.mwoNumber },
      include: mwoInclude,
    });

    if (!mwo) {
      throw new NotFoundException('Maintenance work order not found');
    }

    return mwo;
  }

  async startMaintenanceWorkOrder(
    input: StartMaintenanceWorkOrderInput,
    actorId?: string,
  ) {
    const mwo = await this.prisma.maintenanceWorkOrder.findUnique({
      where: { id: input.id },
    });
    if (!mwo) {
      throw new NotFoundException('Maintenance work order not found');
    }
    if (mwo.status !== 'OPEN') {
      throw new BadRequestException('Only OPEN maintenance work orders can be started');
    }

    const updated = await this.prisma.maintenanceWorkOrder.update({
      where: { id: input.id },
      data: { status: 'IN_PROGRESS' },
      include: mwoInclude,
    });

    await this.audit.record({
      actorId,
      action: 'cmms.workorder.started',
      entityType: 'MaintenanceWorkOrder',
      entityId: updated.id,
      metadata: { mwoNumber: updated.mwoNumber },
    });

    return updated;
  }

  async completeMaintenanceWorkOrder(
    input: CompleteMaintenanceWorkOrderInput,
    actorId?: string,
  ) {
    const mwo = await this.prisma.maintenanceWorkOrder.findUnique({
      where: { id: input.id },
      include: { triggerRule: true },
    });
    if (!mwo) {
      throw new NotFoundException('Maintenance work order not found');
    }
    if (mwo.status !== 'OPEN' && mwo.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only OPEN or IN_PROGRESS maintenance work orders can be completed',
      );
    }
    if (!actorId) {
      throw new BadRequestException('Technician user id is required');
    }

    const updated = await this.prisma.maintenanceWorkOrder.update({
      where: { id: input.id },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
        completedByUserId: actorId,
        notes: input.notes ?? mwo.notes,
      },
      include: mwoInclude,
    });

    await this.audit.record({
      actorId,
      action: 'cmms.workorder.completed',
      entityType: 'MaintenanceWorkOrder',
      entityId: updated.id,
      metadata: { mwoNumber: updated.mwoNumber },
    });

    await this.eventBus.publish(CMMS_EVENTS.workorder.completed, {
      entityId: updated.id,
      actorId,
      payload: {
        mwoId: updated.id,
        mwoNumber: updated.mwoNumber,
        assetId: updated.assetId,
        triggerRuleId: updated.triggerRuleId,
        completedByUserId: actorId,
      },
    });

    return updated;
  }

  async cancelMaintenanceWorkOrder(
    input: CancelMaintenanceWorkOrderInput,
    actorId?: string,
  ) {
    const mwo = await this.prisma.maintenanceWorkOrder.findUnique({
      where: { id: input.id },
    });
    if (!mwo) {
      throw new NotFoundException('Maintenance work order not found');
    }
    if (mwo.status === 'COMPLETED' || mwo.status === 'CANCELLED') {
      throw new BadRequestException('Maintenance work order is already closed');
    }

    const updated = await this.prisma.maintenanceWorkOrder.update({
      where: { id: input.id },
      data: {
        status: 'CANCELLED',
        notes: input.notes ?? mwo.notes,
      },
      include: mwoInclude,
    });

    await this.audit.record({
      actorId,
      action: 'cmms.workorder.cancelled',
      entityType: 'MaintenanceWorkOrder',
      entityId: updated.id,
      metadata: { mwoNumber: updated.mwoNumber },
    });

    return updated;
  }

  async recordCycleForWorkstation(workstationId: string): Promise<void> {
    const assets = await this.prisma.asset.findMany({
      where: { workstationId },
      include: {
        triggerRules: {
          where: { active: true, type: 'CYCLE_COUNT' },
        },
      },
    });

    for (const asset of assets) {
      const updatedAsset = await this.prisma.asset.update({
        where: { id: asset.id },
        data: { cumulativeCycles: { increment: 1 } },
      });

      for (const rule of asset.triggerRules) {
        if (!rule.thresholdCycles) continue;

        if (
          !shouldTriggerCycle(
            updatedAsset.cumulativeCycles,
            rule.lastTriggeredCycles,
            rule.thresholdCycles,
          )
        ) {
          continue;
        }

        const hasOpen = await this.hasOpenMwoForRule(rule.id);
        if (hasOpen) continue;

        await this.createPreventiveMwoFromRule(
          updatedAsset.id,
          rule.id,
          updatedAsset.cumulativeCycles,
          { updateLastTriggeredCycles: updatedAsset.cumulativeCycles },
        );
      }
    }
  }

  async evaluateCalendarTriggers(): Promise<{ created: number }> {
    const rules = await this.prisma.pmTriggerRule.findMany({
      where: { active: true, type: 'CALENDAR' },
      include: { asset: true },
    });

    let created = 0;
    const now = new Date();

    for (const rule of rules) {
      if (!rule.intervalDays) continue;
      if (!shouldTriggerCalendar(rule.lastTriggeredAt, rule.intervalDays, now)) {
        continue;
      }

      const hasOpen = await this.hasOpenMwoForRule(rule.id);
      if (hasOpen) continue;

      await this.createPreventiveMwoFromRule(rule.assetId, rule.id, undefined, {
        updateLastTriggeredAt: now,
      });
      created += 1;
    }

    return { created };
  }

  async getDueSoon(input: GetDueSoonInput = {}) {
    const take = input.take ?? 50;
    const now = new Date();

    const openMwos = await this.prisma.maintenanceWorkOrder.findMany({
      where: { status: { in: OPEN_MWO_STATUSES } },
      include: mwoInclude,
      orderBy: { scheduledDate: 'asc' },
      take: 100,
    });

    const dueSoonMwos = openMwos.filter(
      (mwo) =>
        isMwoDueSoon(mwo.status, mwo.scheduledDate, now) ||
        isMwoOverdue(mwo.status, mwo.scheduledDate, now),
    );

    const cycleRules = await this.prisma.pmTriggerRule.findMany({
      where: { active: true, type: 'CYCLE_COUNT' },
      include: { asset: true },
      take: 100,
    });

    const dueSoonCycleRules = cycleRules.filter((rule) => {
      if (!rule.thresholdCycles) return false;
      const overdue = isCycleOverdue(
        rule.asset.cumulativeCycles,
        rule.lastTriggeredCycles,
        rule.thresholdCycles,
      );
      const dueSoon = isCycleDueSoon(
        rule.asset.cumulativeCycles,
        rule.lastTriggeredCycles,
        rule.thresholdCycles,
      );
      return overdue || dueSoon;
    });

    const calendarRules = await this.prisma.pmTriggerRule.findMany({
      where: { active: true, type: 'CALENDAR' },
      include: { asset: true },
      take: 100,
    });

    const dueSoonCalendarRules = calendarRules.filter((rule) => {
      if (!rule.intervalDays) return false;
      const overdue = isCalendarOverdue(rule.lastTriggeredAt, rule.intervalDays, now);
      const dueSoon = isCalendarDueSoon(rule.lastTriggeredAt, rule.intervalDays, now);
      return overdue || dueSoon;
    });

    return {
      maintenanceWorkOrders: dueSoonMwos.slice(0, take),
      cycleRules: dueSoonCycleRules.slice(0, take),
      calendarRules: dueSoonCalendarRules.slice(0, take),
    };
  }

  async getMaintenanceHistoryForWorkOrder(
    input: GetMaintenanceHistoryForWorkOrderInput,
  ) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
      include: {
        operations: {
          select: { workstationId: true },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException('Work order not found');
    }

    const workstationIds = [
      ...new Set(
        workOrder.operations
          .map((op) => op.workstationId)
          .filter((id): id is string => id != null),
      ),
    ];

    if (workstationIds.length === 0) {
      return { assets: [], maintenanceWorkOrders: [] };
    }

    const assets = await this.prisma.asset.findMany({
      where: { workstationId: { in: workstationIds } },
      include: assetInclude,
    });

    const assetIds = assets.map((a) => a.id);
    if (assetIds.length === 0) {
      return { assets: [], maintenanceWorkOrders: [] };
    }

    const maintenanceWorkOrders = await this.prisma.maintenanceWorkOrder.findMany({
      where: { assetId: { in: assetIds } },
      include: mwoInclude,
      orderBy: { createdAt: 'desc' },
      take: input.take ?? 20,
    });

    return { assets, maintenanceWorkOrders };
  }

  private async hasOpenMwoForRule(triggerRuleId: string): Promise<boolean> {
    const open = await this.prisma.maintenanceWorkOrder.findFirst({
      where: {
        triggerRuleId,
        status: { in: OPEN_MWO_STATUSES },
      },
    });
    return open != null;
  }

  private async createPreventiveMwoFromRule(
    assetId: string,
    triggerRuleId: string,
    cumulativeCycles: number | undefined,
    updates: {
      updateLastTriggeredCycles?: number;
      updateLastTriggeredAt?: Date;
    },
  ): Promise<void> {
    const rule = await this.prisma.pmTriggerRule.findUnique({
      where: { id: triggerRuleId },
      include: { asset: true },
    });
    if (!rule) return;

    const description =
      rule.type === 'CYCLE_COUNT'
        ? `Preventive maintenance — cycle threshold (${rule.thresholdCycles} cycles) reached for ${rule.asset.code}`
        : `Preventive maintenance — calendar interval (${rule.intervalDays} days) elapsed for ${rule.asset.code}`;

    const mwoNumber = await this.nextMwoNumber();
    const mwo = await this.prisma.maintenanceWorkOrder.create({
      data: {
        mwoNumber,
        assetId,
        triggerRuleId,
        type: 'PREVENTIVE',
        description,
        scheduledDate: new Date(),
      },
      include: mwoInclude,
    });

    await this.prisma.pmTriggerRule.update({
      where: { id: triggerRuleId },
      data: {
        ...(updates.updateLastTriggeredCycles != null
          ? { lastTriggeredCycles: updates.updateLastTriggeredCycles }
          : {}),
        ...(updates.updateLastTriggeredAt
          ? { lastTriggeredAt: updates.updateLastTriggeredAt }
          : {}),
      },
    });

    await this.audit.record({
      action: 'cmms.workorder.created',
      entityType: 'MaintenanceWorkOrder',
      entityId: mwo.id,
      metadata: {
        mwoNumber,
        assetId,
        triggerRuleId,
        cumulativeCycles,
        automatic: true,
      },
    });

    await this.eventBus.publish(CMMS_EVENTS.pm.triggered, {
      entityId: mwo.id,
      payload: {
        mwoId: mwo.id,
        mwoNumber: mwo.mwoNumber,
        assetId,
        triggerRuleId,
        triggerType: rule.type as PmTriggerType,
        cumulativeCycles,
      },
    });

    await this.eventBus.publish(CMMS_EVENTS.workorder.created, {
      entityId: mwo.id,
      payload: {
        mwoId: mwo.id,
        mwoNumber: mwo.mwoNumber,
        assetId,
        type: 'PREVENTIVE',
        triggerRuleId,
      },
    });
  }

  private async nextMwoNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `MWO-${year}-`;
    const latest = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { mwoNumber: { startsWith: prefix } },
      orderBy: { mwoNumber: 'desc' },
      select: { mwoNumber: true },
    });

    let maxSeq = 0;
    if (latest) {
      const parsed = parseMwoSequence(latest.mwoNumber, year);
      if (parsed != null) maxSeq = parsed;
    }

    return formatMwoNumber(year, maxSeq + 1);
  }
}
