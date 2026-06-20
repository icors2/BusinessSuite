import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperationStatus,
  Prisma,
  TimeEntryStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import {
  allOperationsCompleted,
  canStartOperation,
  computeCycleDuration,
} from './cycle';
import { MES_EVENTS } from './events';
import { renderPlacardHtml } from './placard';
import {
  GenerateOperationsInput,
  GetDashboardInput,
  GetPlacardInput,
  ListOperationsInput,
  ListWorkstationsInput,
  StartOperationInput,
  StopOperationInput,
  UpsertOperationInput,
  UpsertWorkstationInput,
  VerifyWorkOrderInput,
} from './schemas';

const operationInclude = {
  workstation: true,
  workOrder: { include: { product: true } },
  cycles: {
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' as const },
  },
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

@Injectable()
export class MesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async upsertWorkstation(input: UpsertWorkstationInput, actorId?: string) {
    const ws = await this.prisma.workstation.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        description: input.description,
        status: input.status ?? 'ACTIVE',
      },
      update: {
        name: input.name,
        description: input.description,
        status: input.status,
      },
    });

    await this.audit.record({
      actorId,
      action: 'mes.workstation.upserted',
      entityType: 'Workstation',
      entityId: ws.id,
      metadata: { code: ws.code },
    });

    return ws;
  }

  async listWorkstations(input: ListWorkstationsInput = {}) {
    const where: Prisma.WorkstationWhereInput = {};
    if (input.status) {
      where.status = input.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.workstation.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.workstation.count({ where }),
    ]);

    return { items, total };
  }

  async upsertOperation(input: UpsertOperationInput, actorId?: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
    });
    if (!wo) {
      throw new NotFoundException('Work order not found');
    }

    const op = await this.prisma.workOrderOperation.upsert({
      where: {
        workOrderId_sequence: {
          workOrderId: input.workOrderId,
          sequence: input.sequence,
        },
      },
      create: {
        workOrderId: input.workOrderId,
        sequence: input.sequence,
        name: input.name,
        workstationId: input.workstationId,
        standardMinutes: input.standardMinutes,
      },
      update: {
        name: input.name,
        workstationId: input.workstationId,
        standardMinutes: input.standardMinutes,
      },
      include: operationInclude,
    });

    await this.audit.record({
      actorId,
      action: 'mes.operation.upserted',
      entityType: 'WorkOrderOperation',
      entityId: op.id,
    });

    return op;
  }

  async generateOperations(input: GenerateOperationsInput, actorId?: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
    });
    if (!wo) {
      throw new NotFoundException('Work order not found');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < input.operations.length; i++) {
        const def = input.operations[i];
        const op = await tx.workOrderOperation.upsert({
          where: {
            workOrderId_sequence: {
              workOrderId: input.workOrderId,
              sequence: i + 1,
            },
          },
          create: {
            workOrderId: input.workOrderId,
            sequence: i + 1,
            name: def.name,
            workstationId: def.workstationId,
            standardMinutes: def.standardMinutes,
          },
          update: {
            name: def.name,
            workstationId: def.workstationId,
            standardMinutes: def.standardMinutes,
          },
        });
        results.push(op);
      }
      return results;
    });

    await this.audit.record({
      actorId,
      action: 'mes.operations.generated',
      entityType: 'WorkOrder',
      entityId: input.workOrderId,
      metadata: { count: created.length },
    });

    return { operations: created };
  }

  async listOperations(input: ListOperationsInput = {}) {
    const where: Prisma.WorkOrderOperationWhereInput = {};
    if (input.workOrderId) where.workOrderId = input.workOrderId;
    if (input.workstationId) where.workstationId = input.workstationId;
    if (input.status) where.status = input.status;

    const [items, total] = await Promise.all([
      this.prisma.workOrderOperation.findMany({
        where,
        include: operationInclude,
        orderBy: [{ workOrderId: 'asc' }, { sequence: 'asc' }],
        skip: input.skip,
        take: input.take ?? 100,
      }),
      this.prisma.workOrderOperation.count({ where }),
    ]);

    return { items, total };
  }

  async startOperation(input: StartOperationInput, actorId?: string) {
    const employee = await this.resolveEmployee(input.employeeId, input.badgeCode);

    const openEntry = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId: employee.id,
        status: TimeEntryStatus.OPEN,
      },
    });
    if (!openEntry) {
      throw new BadRequestException(
        'Operator must be clocked in before starting an operation',
      );
    }

    const operation = await this.prisma.workOrderOperation.findUnique({
      where: { id: input.operationId },
      include: { workOrder: true },
    });
    if (!operation) {
      throw new NotFoundException('Operation not found');
    }
    if (!canStartOperation(operation.status)) {
      throw new BadRequestException(
        `Cannot start operation in status ${operation.status}`,
      );
    }

    const openCycle = await this.prisma.cycleRecord.findFirst({
      where: { operationId: operation.id, endedAt: null },
    });
    if (openCycle) {
      throw new BadRequestException('Operation already has an open cycle');
    }

    const startedAt = input.startedAt ?? new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.cycleRecord.create({
        data: {
          operationId: operation.id,
          employeeId: employee.id,
          startedAt,
        },
      });

      const updatedOp = await tx.workOrderOperation.update({
        where: { id: operation.id },
        data: { status: OperationStatus.IN_PROGRESS },
        include: operationInclude,
      });

      if (
        operation.workOrder.status === WorkOrderStatus.PROPOSED ||
        operation.workOrder.status === WorkOrderStatus.FIRM
      ) {
        await tx.workOrder.update({
          where: { id: operation.workOrderId },
          data: { status: WorkOrderStatus.IN_PROGRESS },
        });
      }

      return { cycle, operation: updatedOp };
    });

    await this.audit.record({
      actorId,
      action: 'mes.operation.started',
      entityType: 'CycleRecord',
      entityId: result.cycle.id,
      metadata: {
        operationId: operation.id,
        employeeId: employee.id,
      },
    });

    await this.eventBus.publish(MES_EVENTS.operation.started, {
      entityId: result.cycle.id,
      actorId,
      payload: {
        cycleId: result.cycle.id,
        operationId: operation.id,
        workOrderId: operation.workOrderId,
        employeeId: employee.id,
        startedAt: startedAt.toISOString(),
      },
    });

    return result;
  }

  async stopOperation(input: StopOperationInput, actorId?: string) {
    const cycle = await this.prisma.cycleRecord.findUnique({
      where: { id: input.cycleId },
      include: {
        operation: { include: { workOrder: true } },
        employee: true,
      },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle record not found');
    }
    if (cycle.endedAt) {
      throw new BadRequestException('Cycle is already closed');
    }

    const endedAt = input.endedAt ?? new Date();
    if (endedAt.getTime() <= cycle.startedAt.getTime()) {
      throw new BadRequestException('endedAt must be after startedAt');
    }

    const durationMinutes = computeCycleDuration(cycle.startedAt, endedAt);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedCycle = await tx.cycleRecord.update({
        where: { id: cycle.id },
        data: {
          endedAt,
          durationMinutes,
          quantityCompleted: input.quantityCompleted,
          quantityScrapped: input.quantityScrapped ?? 0,
        },
      });

      const updatedOp = await tx.workOrderOperation.update({
        where: { id: cycle.operationId },
        data: { status: OperationStatus.COMPLETED },
        include: operationInclude,
      });

      const allOps = await tx.workOrderOperation.findMany({
        where: { workOrderId: cycle.operation.workOrderId },
        select: { status: true },
      });

      if (allOperationsCompleted(allOps.map((o) => o.status))) {
        await tx.workOrder.update({
          where: { id: cycle.operation.workOrderId },
          data: { status: WorkOrderStatus.AWAITING_VERIFICATION },
        });
      }

      return { cycle: updatedCycle, operation: updatedOp };
    });

    await this.audit.record({
      actorId,
      action: 'mes.operation.completed',
      entityType: 'CycleRecord',
      entityId: cycle.id,
      metadata: { durationMinutes, quantityCompleted: input.quantityCompleted },
    });

    await this.eventBus.publish(MES_EVENTS.operation.completed, {
      entityId: cycle.id,
      actorId,
      payload: {
        cycleId: cycle.id,
        operationId: cycle.operationId,
        workOrderId: cycle.operation.workOrderId,
        durationMinutes,
        quantityCompleted: input.quantityCompleted,
      },
    });

    await this.eventBus.publish(MES_EVENTS.cycle.recorded, {
      entityId: cycle.id,
      actorId,
      payload: {
        cycleId: cycle.id,
        operationId: cycle.operationId,
        employeeId: cycle.employeeId,
        durationMinutes,
        quantityCompleted: input.quantityCompleted,
        quantityScrapped: input.quantityScrapped ?? 0,
      },
    });

    return result;
  }

  async verifyWorkOrder(input: VerifyWorkOrderInput, actorId?: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
      include: { operations: true, verification: true },
    });
    if (!wo) {
      throw new NotFoundException('Work order not found');
    }
    if (wo.verification) {
      throw new BadRequestException('Work order is already verified');
    }
    if (!allOperationsCompleted(wo.operations.map((o) => o.status))) {
      throw new BadRequestException(
        'All operations must be completed before verification',
      );
    }
    if (wo.status !== WorkOrderStatus.AWAITING_VERIFICATION) {
      throw new BadRequestException(
        `Work order must be awaiting verification (current: ${wo.status})`,
      );
    }

    const verification = await this.prisma.$transaction(async (tx) => {
      const record = await tx.workOrderVerification.create({
        data: {
          workOrderId: input.workOrderId,
          verifiedByUserId: actorId ?? 'system',
          verifiedByEmployeeId: input.verifiedByEmployeeId,
          notes: input.notes,
          photoObjectKey: input.photoObjectKey,
          photoFileName: input.photoFileName,
        },
      });

      await tx.workOrder.update({
        where: { id: input.workOrderId },
        data: { status: WorkOrderStatus.VERIFIED },
      });

      return record;
    });

    await this.audit.record({
      actorId,
      action: 'mes.workorder.verified',
      entityType: 'WorkOrderVerification',
      entityId: verification.id,
      metadata: { workOrderId: input.workOrderId },
    });

    await this.eventBus.publish(MES_EVENTS.workorder.verified, {
      entityId: verification.id,
      actorId,
      payload: {
        workOrderId: input.workOrderId,
        verificationId: verification.id,
        photoObjectKey: input.photoObjectKey,
      },
    });

    return verification;
  }

  async getDashboard(input: GetDashboardInput = {}) {
    const where: Prisma.WorkOrderOperationWhereInput = {};
    if (input.workstationId) {
      where.workstationId = input.workstationId;
    }

    const [inProgress, pending, openCycles, awaitingVerification] =
      await Promise.all([
        this.prisma.workOrderOperation.findMany({
          where: { ...where, status: OperationStatus.IN_PROGRESS },
          include: operationInclude,
          take: 50,
        }),
        this.prisma.workOrderOperation.findMany({
          where: { ...where, status: OperationStatus.PENDING },
          include: operationInclude,
          take: 50,
        }),
        this.prisma.cycleRecord.findMany({
          where: { endedAt: null },
          include: {
            operation: { include: { workstation: true, workOrder: true } },
            employee: true,
          },
          orderBy: { startedAt: 'asc' },
        }),
        this.prisma.workOrder.findMany({
          where: { status: WorkOrderStatus.AWAITING_VERIFICATION },
          include: { product: true, operations: true },
          take: 20,
        }),
      ]);

    return {
      inProgress,
      pending,
      openCycles,
      awaitingVerification,
    };
  }

  async getPlacard(input: GetPlacardInput) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
      include: {
        product: true,
        operations: {
          include: { workstation: true },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!wo) {
      throw new NotFoundException('Work order not found');
    }

    const html = renderPlacardHtml(
      {
        woNumber: wo.woNumber,
        productSku: wo.product.sku,
        quantity: toNumber(wo.quantity),
        status: wo.status,
      },
      wo.operations.map((op) => ({
        sequence: op.sequence,
        name: op.name,
        status: op.status,
        workstationCode: op.workstation?.code,
      })),
    );

    return { woNumber: wo.woNumber, html };
  }

  async listOpenCycles(workstationId?: string) {
    const cycles = await this.prisma.cycleRecord.findMany({
      where: {
        endedAt: null,
        ...(workstationId
          ? { operation: { workstationId } }
          : {}),
      },
      include: {
        operation: { include: { workstation: true, workOrder: true } },
        employee: true,
      },
    });
    return { items: cycles, total: cycles.length };
  }

  private async resolveEmployee(employeeId?: string, badgeCode?: string) {
    if (employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
      return employee;
    }
    if (badgeCode) {
      const employee = await this.prisma.employee.findUnique({
        where: { badgeCode },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found for badge code');
      }
      return employee;
    }
    throw new BadRequestException('employeeId or badgeCode is required');
  }
}
