import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmploymentStatus,
  Prisma,
  TimeEntryStatus,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { isUnavailable, normalizeDateUtc } from './availability';
import { validateClockOut } from './clock';
import { WORKFORCE_EVENTS } from './events';
import { rollUpLaborCost } from './labor-cost';
import {
  nextEmployeeNumber,
} from './numbering';
import {
  AssignShiftInput,
  ClockInInput,
  ClockOutInput,
  CreateEmployeeInput,
  LaborCostReportInput,
  ListAssignmentsInput,
  ListEmployeesInput,
  ListShiftsInput,
  MarkUnavailableInput,
  UpdateEmployeeInput,
  UpsertShiftInput,
} from './schemas';

const employeeInclude = {
  user: { select: { id: true, email: true } },
};

const assignmentInclude = {
  shift: true,
  employee: true,
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

@Injectable()
export class WorkforceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async createEmployee(input: CreateEmployeeInput, actorId?: string) {
    const employeeNumber = await this.nextEmployeeNumberFromDb();

    const employee = await this.prisma.employee.create({
      data: {
        employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        department: input.department,
        badgeCode: input.badgeCode,
        laborRate: input.laborRate ?? 0,
        userId: input.userId,
      },
      include: employeeInclude,
    });

    await this.audit.record({
      actorId,
      action: 'workforce.employee.created',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { employeeNumber: employee.employeeNumber },
    });

    return this.mapEmployee(employee);
  }

  async listEmployees(input: ListEmployeesInput = {}) {
    const where: Prisma.EmployeeWhereInput = {};
    if (input.status) {
      where.status = input.status;
    }
    if (input.department) {
      where.department = input.department;
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: { employeeNumber: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: items.map((e) => this.mapEmployee(e)),
      total,
    };
  }

  async updateEmployee(input: UpdateEmployeeInput, actorId?: string) {
    const existing = await this.prisma.employee.findUnique({
      where: { id: input.employeeId },
    });
    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    const employee = await this.prisma.employee.update({
      where: { id: input.employeeId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        department: input.department,
        badgeCode: input.badgeCode,
        laborRate: input.laborRate,
        status: input.status,
        userId: input.userId,
      },
      include: employeeInclude,
    });

    await this.audit.record({
      actorId,
      action: 'workforce.employee.updated',
      entityType: 'Employee',
      entityId: employee.id,
    });

    return this.mapEmployee(employee);
  }

  async upsertShift(input: UpsertShiftInput, actorId?: string) {
    const shift = await this.prisma.shift.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        daysOfWeek: input.daysOfWeek,
        active: input.active ?? true,
      },
      update: {
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        daysOfWeek: input.daysOfWeek,
        active: input.active,
      },
    });

    await this.audit.record({
      actorId,
      action: 'workforce.shift.upserted',
      entityType: 'Shift',
      entityId: shift.id,
      metadata: { code: shift.code },
    });

    return shift;
  }

  async listShifts(input: ListShiftsInput = {}) {
    const where: Prisma.ShiftWhereInput = {};
    if (input.activeOnly) {
      where.active = true;
    }

    const [items, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.shift.count({ where }),
    ]);

    return { items, total };
  }

  async assignShift(input: AssignShiftInput, actorId?: string) {
    const date = normalizeDateUtc(input.date);
    const dayOfWeek = date.getUTCDay();

    const [shift, employee, calendarDay, unavailability] = await Promise.all([
      this.prisma.shift.findUnique({ where: { id: input.shiftId } }),
      this.prisma.employee.findUnique({ where: { id: input.employeeId } }),
      this.prisma.factoryCalendarDay.findUnique({ where: { date } }),
      this.prisma.employeeUnavailability.findMany({
        where: { employeeId: input.employeeId },
      }),
    ]);

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (employee.status !== EmploymentStatus.ACTIVE) {
      throw new BadRequestException('Employee is not active');
    }
    if (!shift.active) {
      throw new BadRequestException('Shift is not active');
    }
    if (!shift.daysOfWeek.includes(dayOfWeek)) {
      throw new BadRequestException('Shift does not run on this day of week');
    }
    if (!calendarDay?.isWorkingDay) {
      throw new BadRequestException('Date is not a working factory calendar day');
    }
    if (
      isUnavailable(
        input.employeeId,
        date,
        unavailability.map((u) => ({
          employeeId: u.employeeId,
          fromDate: u.fromDate,
          toDate: u.toDate,
        })),
      )
    ) {
      throw new BadRequestException('Employee is unavailable on this date');
    }

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        shiftId: input.shiftId,
        employeeId: input.employeeId,
        date,
      },
      include: assignmentInclude,
    });

    await this.audit.record({
      actorId,
      action: 'workforce.shift.assigned',
      entityType: 'ShiftAssignment',
      entityId: assignment.id,
      metadata: {
        shiftId: assignment.shiftId,
        employeeId: assignment.employeeId,
        date: assignment.date.toISOString(),
      },
    });

    await this.eventBus.publish(WORKFORCE_EVENTS.shift.assigned, {
      entityId: assignment.id,
      actorId,
      payload: {
        assignmentId: assignment.id,
        shiftId: assignment.shiftId,
        employeeId: assignment.employeeId,
        date: assignment.date.toISOString(),
      },
    });

    return assignment;
  }

  async listAssignments(input: ListAssignmentsInput) {
    const from = normalizeDateUtc(input.from);
    const to = normalizeDateUtc(input.to);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be before or equal to to');
    }

    const shiftFilter: Prisma.ShiftWhereInput = input.shiftId
      ? { id: input.shiftId }
      : { active: true };

    const [shifts, assignments] = await Promise.all([
      this.prisma.shift.findMany({
        where: shiftFilter,
        orderBy: { code: 'asc' },
      }),
      this.prisma.shiftAssignment.findMany({
        where: {
          date: { gte: from, lte: to },
          ...(input.shiftId ? { shiftId: input.shiftId } : {}),
        },
        include: assignmentInclude,
        orderBy: [{ date: 'asc' }, { shiftId: 'asc' }],
      }),
    ]);

    const assignmentKeys = new Set(
      assignments.map(
        (a) =>
          `${a.shiftId}:${normalizeDateUtc(a.date).toISOString().slice(0, 10)}`,
      ),
    );

    const coverageGaps: Array<{
      shiftId: string;
      shiftCode: string;
      date: string;
      assigned: boolean;
    }> = [];

    for (
      let cursor = new Date(from);
      cursor.getTime() <= to.getTime();
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const day = cursor.getUTCDay();
      const dateKey = cursor.toISOString().slice(0, 10);

      for (const shift of shifts) {
        if (!shift.daysOfWeek.includes(day)) {
          continue;
        }
        const key = `${shift.id}:${dateKey}`;
        const assigned = assignmentKeys.has(key);
        if (!assigned) {
          coverageGaps.push({
            shiftId: shift.id,
            shiftCode: shift.code,
            date: dateKey,
            assigned: false,
          });
        }
      }
    }

    return {
      assignments,
      coverageGaps,
      total: assignments.length,
    };
  }

  async markUnavailable(input: MarkUnavailableInput, actorId?: string) {
    const fromDate = normalizeDateUtc(input.fromDate);
    const toDate = normalizeDateUtc(input.toDate);
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: input.employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const record = await this.prisma.employeeUnavailability.create({
      data: {
        employeeId: input.employeeId,
        fromDate,
        toDate,
        reason: input.reason,
      },
    });

    await this.audit.record({
      actorId,
      action: 'workforce.unavailability.created',
      entityType: 'EmployeeUnavailability',
      entityId: record.id,
      metadata: { employeeId: record.employeeId },
    });

    return record;
  }

  async clockIn(input: ClockInInput, actorId?: string) {
    const employee = await this.resolveEmployee(input.employeeId, input.badgeCode);
    if (employee.status !== EmploymentStatus.ACTIVE) {
      throw new BadRequestException('Employee is not active');
    }

    const openEntry = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId: employee.id,
        status: TimeEntryStatus.OPEN,
      },
    });
    if (openEntry) {
      throw new BadRequestException('Employee already has an open time entry');
    }

    if (input.workOrderId) {
      const workOrder = await this.prisma.workOrder.findUnique({
        where: { id: input.workOrderId },
      });
      if (!workOrder) {
        throw new NotFoundException('Work order not found');
      }
    }

    const clockIn = input.clockIn ?? new Date();
    const entry = await this.prisma.timeEntry.create({
      data: {
        employeeId: employee.id,
        clockIn,
        workOrderId: input.workOrderId,
        department: input.department ?? employee.department,
        status: TimeEntryStatus.OPEN,
      },
    });

    await this.audit.record({
      actorId,
      action: 'workforce.clock.in',
      entityType: 'TimeEntry',
      entityId: entry.id,
      metadata: { employeeId: employee.id },
    });

    await this.eventBus.publish(WORKFORCE_EVENTS.clock.in, {
      entityId: entry.id,
      actorId,
      payload: {
        timeEntryId: entry.id,
        employeeId: employee.id,
        clockIn: entry.clockIn.toISOString(),
        workOrderId: entry.workOrderId,
      },
    });

    return entry;
  }

  async clockOut(input: ClockOutInput, actorId?: string) {
    const employee = await this.resolveEmployee(input.employeeId, input.badgeCode);

    const openEntry = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId: employee.id,
        status: TimeEntryStatus.OPEN,
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!openEntry) {
      throw new BadRequestException('No open time entry to clock out');
    }

    const clockOut = input.clockOut ?? new Date();
    if (clockOut.getTime() <= openEntry.clockIn.getTime()) {
      throw new BadRequestException('clockOut must be after clockIn');
    }

    const validation = validateClockOut(
      openEntry.clockIn,
      clockOut,
      input.maxShiftHours,
    );

    const entry = await this.prisma.timeEntry.update({
      where: { id: openEntry.id },
      data: {
        clockOut,
        durationMinutes: validation.durationMinutes,
        status: validation.status as TimeEntryStatus,
        flagReason: validation.flagReason,
      },
    });

    await this.audit.record({
      actorId,
      action: 'workforce.clock.out',
      entityType: 'TimeEntry',
      entityId: entry.id,
      metadata: {
        employeeId: employee.id,
        durationMinutes: entry.durationMinutes,
        status: entry.status,
      },
    });

    await this.eventBus.publish(WORKFORCE_EVENTS.clock.out, {
      entityId: entry.id,
      actorId,
      payload: {
        timeEntryId: entry.id,
        employeeId: employee.id,
        clockOut: entry.clockOut?.toISOString(),
        durationMinutes: entry.durationMinutes,
        status: entry.status,
        flagReason: entry.flagReason,
      },
    });

    return entry;
  }

  async getLaborCostReport(input: LaborCostReportInput) {
    const from = input.from;
    const to = input.to;

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        clockOut: { gte: from, lte: to },
        status: { in: [TimeEntryStatus.CLOSED, TimeEntryStatus.FLAGGED] },
        durationMinutes: { not: null },
      },
      include: {
        employee: { select: { id: true, laborRate: true } },
      },
    });

    const rateByEmployee: Record<string, number> = {};
    for (const entry of entries) {
      rateByEmployee[entry.employeeId] = toNumber(entry.employee.laborRate);
    }

    const rollUp = rollUpLaborCost(
      entries.map((e) => ({
        employeeId: e.employeeId,
        workOrderId: e.workOrderId,
        department: e.department,
        durationMinutes: e.durationMinutes ?? 0,
      })),
      rateByEmployee,
    );

    const groupBy = input.groupBy ?? 'both';

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      byWorkOrder: groupBy === 'department' ? [] : rollUp.byWorkOrder,
      byDepartment: groupBy === 'workOrder' ? [] : rollUp.byDepartment,
      entryCount: entries.length,
    };
  }

  async listOpenTimeEntries() {
    const entries = await this.prisma.timeEntry.findMany({
      where: { status: TimeEntryStatus.OPEN },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            badgeCode: true,
            department: true,
          },
        },
      },
      orderBy: { clockIn: 'asc' },
    });
    return { items: entries, total: entries.length };
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

  private async nextEmployeeNumberFromDb(): Promise<string> {
    const existing = await this.prisma.employee.findMany({
      where: { employeeNumber: { startsWith: 'EMP-' } },
      select: { employeeNumber: true },
    });
    return nextEmployeeNumber(existing.map((e) => e.employeeNumber));
  }

  private mapEmployee(
    employee: Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>,
  ) {
    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department,
      badgeCode: employee.badgeCode,
      laborRate: toNumber(employee.laborRate),
      status: employee.status,
      userId: employee.userId,
      user: employee.user,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
