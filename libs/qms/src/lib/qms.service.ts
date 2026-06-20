import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NonConformanceSource,
  NonConformanceStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import {
  deriveInspectionResult,
  evaluateCriterion,
  shouldApplyHold,
} from './evaluation';
import { QMS_EVENTS } from './events';
import { formatNcNumber, parseNcSequence } from './nc-number';
import {
  AddCriterionInput,
  CompleteInspectionInput,
  DispositionInput,
  GetInspectionInput,
  GetNonConformanceInput,
  GetTemplateInput,
  ListInspectionsInput,
  ListNonConformancesInput,
  ListTemplatesInput,
  RaiseNonConformanceInput,
  ReportScrapInput,
  UpsertTemplateInput,
} from './schemas';

const templateInclude = {
  criteria: { orderBy: { sequence: 'asc' as const } },
  product: { select: { id: true, sku: true, description: true } },
};

const inspectionInclude = {
  template: { include: { criteria: { orderBy: { sequence: 'asc' as const } } } },
  workOrder: { select: { id: true, woNumber: true, onHold: true } },
  operation: { select: { id: true, name: true, sequence: true } },
  results: { include: { criterion: true } },
  nonConformances: true,
};

const ncInclude = {
  inspection: { select: { id: true, result: true } },
  workOrder: { select: { id: true, woNumber: true, onHold: true } },
  bin: { select: { id: true, code: true, onHold: true } },
  product: { select: { id: true, sku: true } },
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

@Injectable()
export class QmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async upsertTemplate(input: UpsertTemplateInput, actorId?: string) {
    const template = await this.prisma.inspectionTemplate.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        description: input.description,
        productId: input.productId,
        operationName: input.operationName,
        active: input.active ?? true,
      },
      update: {
        name: input.name,
        description: input.description,
        productId: input.productId,
        operationName: input.operationName,
        active: input.active,
      },
      include: templateInclude,
    });

    await this.audit.record({
      actorId,
      action: 'qms.template.upserted',
      entityType: 'InspectionTemplate',
      entityId: template.id,
      metadata: { code: template.code },
    });

    return template;
  }

  async addCriterion(input: AddCriterionInput, actorId?: string) {
    const template = await this.prisma.inspectionTemplate.findUnique({
      where: { id: input.templateId },
    });
    if (!template) {
      throw new NotFoundException('Inspection template not found');
    }

    const criterion = await this.prisma.inspectionCriterion.create({
      data: {
        templateId: input.templateId,
        sequence: input.sequence,
        label: input.label,
        type: input.type,
        expectedMin: input.expectedMin,
        expectedMax: input.expectedMax,
        unit: input.unit,
      },
    });

    await this.audit.record({
      actorId,
      action: 'qms.criterion.added',
      entityType: 'InspectionCriterion',
      entityId: criterion.id,
      metadata: { templateId: input.templateId },
    });

    return criterion;
  }

  async listTemplates(input: ListTemplatesInput = {}) {
    const where: Prisma.InspectionTemplateWhereInput = {};
    if (input.productId) where.productId = input.productId;
    if (input.active != null) where.active = input.active;

    const [items, total] = await Promise.all([
      this.prisma.inspectionTemplate.findMany({
        where,
        include: templateInclude,
        orderBy: { code: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.inspectionTemplate.count({ where }),
    ]);

    return { items, total };
  }

  async getTemplate(input: GetTemplateInput) {
    if (!input.id && !input.code) {
      throw new BadRequestException('id or code is required');
    }

    const template = await this.prisma.inspectionTemplate.findFirst({
      where: input.id ? { id: input.id } : { code: input.code },
      include: templateInclude,
    });

    if (!template) {
      throw new NotFoundException('Inspection template not found');
    }

    return template;
  }

  async completeInspection(
    input: CompleteInspectionInput,
    actorId?: string,
  ) {
    if (!actorId) {
      throw new BadRequestException('Inspector user id is required');
    }

    const template = await this.prisma.inspectionTemplate.findUnique({
      where: { id: input.templateId },
      include: { criteria: { orderBy: { sequence: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Inspection template not found');
    }
    if (template.criteria.length === 0) {
      throw new BadRequestException('Template has no criteria');
    }

    const criterionMap = new Map(template.criteria.map((c) => [c.id, c]));
    for (const r of input.results) {
      if (!criterionMap.has(r.criterionId)) {
        throw new BadRequestException(
          `Criterion ${r.criterionId} does not belong to template`,
        );
      }
    }

    if (input.workOrderId) {
      const wo = await this.prisma.workOrder.findUnique({
        where: { id: input.workOrderId },
      });
      if (!wo) {
        throw new NotFoundException('Work order not found');
      }
    }

    const passes: boolean[] = [];
    for (const criterion of template.criteria) {
      const resultInput = input.results.find(
        (r) => r.criterionId === criterion.id,
      );
      if (!resultInput) {
        throw new BadRequestException(
          `Missing result for criterion ${criterion.label}`,
        );
      }

      passes.push(
        evaluateCriterion(
          {
            type: criterion.type,
            expectedMin:
              criterion.expectedMin != null
                ? toNumber(criterion.expectedMin)
                : null,
            expectedMax:
              criterion.expectedMax != null
                ? toNumber(criterion.expectedMax)
                : null,
          },
          {
            passed: resultInput.passed,
            measuredValue: resultInput.measuredValue,
          },
        ),
      );
    }

    const result = deriveInspectionResult(passes);

    const record = await this.prisma.$transaction(async (tx) => {
      const inspection = await tx.inspectionRecord.create({
        data: {
          templateId: input.templateId,
          workOrderId: input.workOrderId,
          operationId: input.operationId,
          inspectorUserId: actorId,
          inspectorEmployeeId: input.inspectorEmployeeId,
          result,
          notes: input.notes,
          results: {
            create: input.results.map((r) => ({
              criterionId: r.criterionId,
              passed: r.passed,
              measuredValue: r.measuredValue,
              photoObjectKey: r.photoObjectKey,
              photoFileName: r.photoFileName,
              notes: r.notes,
            })),
          },
        },
        include: inspectionInclude,
      });

      return inspection;
    });

    await this.audit.record({
      actorId,
      action: 'qms.inspection.completed',
      entityType: 'InspectionRecord',
      entityId: record.id,
      metadata: { result, workOrderId: input.workOrderId },
    });

    await this.eventBus.publish(QMS_EVENTS.inspection.completed, {
      entityId: record.id,
      actorId,
      payload: {
        inspectionId: record.id,
        templateId: input.templateId,
        workOrderId: input.workOrderId,
        operationId: input.operationId,
        result,
      },
    });

    if (result === 'FAIL') {
      const nc = await this.createNonConformance(
        {
          description: `Failed inspection ${record.id}`,
          severity: 'HOLD',
          inspectionId: record.id,
          workOrderId: input.workOrderId,
        },
        NonConformanceSource.INSPECTION,
        actorId,
      );
      return { inspection: record, nonConformance: nc };
    }

    return { inspection: record, nonConformance: null };
  }

  async raiseNonConformance(
    input: RaiseNonConformanceInput,
    actorId?: string,
  ) {
    const nc = await this.createNonConformance(
      input,
      NonConformanceSource.INSPECTION,
      actorId,
    );
    return nc;
  }

  async reportScrap(input: ReportScrapInput, actorId?: string) {
    const nc = await this.createNonConformance(
      {
        description: input.description,
        severity: input.severity,
        workOrderId: input.workOrderId,
        binId: input.binId,
        productId: input.productId,
        quantityScrapped: input.quantityScrapped,
      },
      NonConformanceSource.SCRAP,
      actorId,
    );

    await this.eventBus.publish(QMS_EVENTS.scrap.reported, {
      entityId: nc.id,
      actorId,
      payload: {
        nonConformanceId: nc.id,
        ncNumber: nc.ncNumber,
        workOrderId: input.workOrderId,
        binId: input.binId,
        productId: input.productId,
        quantityScrapped: input.quantityScrapped,
      },
    });

    return nc;
  }

  async raiseReturnNonConformance(
    input: RaiseNonConformanceInput,
    actorId?: string,
  ) {
    return this.createNonConformance(
      input,
      NonConformanceSource.RETURN,
      actorId,
    );
  }

  async disposition(input: DispositionInput, actorId?: string) {
    const nc = await this.prisma.nonConformanceRecord.findUnique({
      where: { id: input.nonConformanceId },
    });
    if (!nc) {
      throw new NotFoundException('Non-conformance record not found');
    }
    if (nc.status === NonConformanceStatus.RESOLVED) {
      throw new BadRequestException('Non-conformance is already resolved');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const resolved = await tx.nonConformanceRecord.update({
        where: { id: nc.id },
        data: {
          status: NonConformanceStatus.RESOLVED,
          disposition: input.disposition,
          dispositionNotes: input.notes,
          resolvedByUserId: actorId,
          resolvedAt: new Date(),
          holdActive: false,
        },
        include: ncInclude,
      });

      if (nc.holdActive) {
        await this.clearHoldFlags(tx, nc.workOrderId, nc.binId);
      }

      return resolved;
    });

    await this.audit.record({
      actorId,
      action: 'qms.nonconformance.resolved',
      entityType: 'NonConformanceRecord',
      entityId: updated.id,
      metadata: { disposition: input.disposition },
    });

    await this.eventBus.publish(QMS_EVENTS.nonconformance.resolved, {
      entityId: updated.id,
      actorId,
      payload: {
        nonConformanceId: updated.id,
        ncNumber: updated.ncNumber,
        disposition: input.disposition,
        workOrderId: updated.workOrderId,
        binId: updated.binId,
      },
    });

    return updated;
  }

  async listInspections(input: ListInspectionsInput = {}) {
    const where: Prisma.InspectionRecordWhereInput = {};
    if (input.workOrderId) where.workOrderId = input.workOrderId;
    if (input.templateId) where.templateId = input.templateId;

    const [items, total] = await Promise.all([
      this.prisma.inspectionRecord.findMany({
        where,
        include: inspectionInclude,
        orderBy: { completedAt: 'desc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.inspectionRecord.count({ where }),
    ]);

    return { items, total };
  }

  async getInspection(input: GetInspectionInput) {
    const inspection = await this.prisma.inspectionRecord.findUnique({
      where: { id: input.id },
      include: inspectionInclude,
    });
    if (!inspection) {
      throw new NotFoundException('Inspection record not found');
    }
    return inspection;
  }

  async listNonConformances(input: ListNonConformancesInput = {}) {
    const where: Prisma.NonConformanceRecordWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.workOrderId) where.workOrderId = input.workOrderId;
    if (input.holdActive != null) where.holdActive = input.holdActive;

    const [items, total] = await Promise.all([
      this.prisma.nonConformanceRecord.findMany({
        where,
        include: ncInclude,
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.nonConformanceRecord.count({ where }),
    ]);

    return { items, total };
  }

  async getNonConformance(input: GetNonConformanceInput) {
    const nc = await this.prisma.nonConformanceRecord.findUnique({
      where: { id: input.id },
      include: ncInclude,
    });
    if (!nc) {
      throw new NotFoundException('Non-conformance record not found');
    }
    return nc;
  }

  private async createNonConformance(
    input: RaiseNonConformanceInput,
    source: NonConformanceSource,
    actorId?: string,
  ) {
    if (!actorId) {
      throw new BadRequestException('User id is required');
    }

    const ncNumber = await this.nextNcNumber();
    const applyHold = shouldApplyHold(input.severity);

    const nc = await this.prisma.$transaction(async (tx) => {
      const record = await tx.nonConformanceRecord.create({
        data: {
          ncNumber,
          source,
          inspectionId: input.inspectionId,
          workOrderId: input.workOrderId,
          binId: input.binId,
          productId: input.productId,
          severity: input.severity,
          holdActive: applyHold,
          description: input.description,
          quantityScrapped: input.quantityScrapped,
          raisedByUserId: actorId,
        },
        include: ncInclude,
      });

      if (applyHold) {
        if (input.workOrderId) {
          await tx.workOrder.update({
            where: { id: input.workOrderId },
            data: { onHold: true },
          });
        }
        if (input.binId) {
          await tx.bin.update({
            where: { id: input.binId },
            data: { onHold: true },
          });
        }
      }

      return record;
    });

    await this.audit.record({
      actorId,
      action: 'qms.nonconformance.raised',
      entityType: 'NonConformanceRecord',
      entityId: nc.id,
      metadata: { ncNumber: nc.ncNumber, severity: input.severity },
    });

    await this.eventBus.publish(QMS_EVENTS.nonconformance.raised, {
      entityId: nc.id,
      actorId,
      payload: {
        nonConformanceId: nc.id,
        ncNumber: nc.ncNumber,
        source,
        severity: input.severity,
        holdActive: applyHold,
        workOrderId: input.workOrderId,
        binId: input.binId,
      },
    });

    return nc;
  }

  private async clearHoldFlags(
    tx: Prisma.TransactionClient,
    workOrderId: string | null,
    binId: string | null,
  ) {
    if (workOrderId) {
      const openHold = await tx.nonConformanceRecord.count({
        where: {
          workOrderId,
          holdActive: true,
          status: { not: NonConformanceStatus.RESOLVED },
        },
      });
      if (openHold === 0) {
        await tx.workOrder.update({
          where: { id: workOrderId },
          data: { onHold: false },
        });
      }
    }

    if (binId) {
      const openHold = await tx.nonConformanceRecord.count({
        where: {
          binId,
          holdActive: true,
          status: { not: NonConformanceStatus.RESOLVED },
        },
      });
      if (openHold === 0) {
        await tx.bin.update({
          where: { id: binId },
          data: { onHold: false },
        });
      }
    }
  }

  private async nextNcNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `NC-${year}-`;
    const latest = await this.prisma.nonConformanceRecord.findFirst({
      where: { ncNumber: { startsWith: prefix } },
      orderBy: { ncNumber: 'desc' },
      select: { ncNumber: true },
    });

    let maxSeq = 0;
    if (latest) {
      const parsed = parseNcSequence(latest.ncNumber, year);
      if (parsed != null) maxSeq = parsed;
    }

    return formatNcNumber(year, maxSeq + 1);
  }
}
