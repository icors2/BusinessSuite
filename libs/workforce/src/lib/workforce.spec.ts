import { computeDurationMinutes, validateClockOut } from './clock';
import { isUnavailable } from './availability';
import { rollUpLaborCost } from './labor-cost';
import {
  formatEmployeeNumber,
  nextEmployeeNumber,
  parseEmployeeSequence,
} from './numbering';

describe('validateClockOut', () => {
  it('computes normal duration as CLOSED', () => {
    const clockIn = new Date('2026-06-19T08:00:00.000Z');
    const clockOut = new Date('2026-06-19T16:00:00.000Z');

    const result = validateClockOut(clockIn, clockOut);

    expect(result.durationMinutes).toBe(480);
    expect(result.status).toBe('CLOSED');
    expect(result.flagReason).toBeNull();
  });

  it('flags crosses-midnight shifts', () => {
    const clockIn = new Date('2026-06-19T22:00:00.000Z');
    const clockOut = new Date('2026-06-20T06:00:00.000Z');

    const result = validateClockOut(clockIn, clockOut);

    expect(result.status).toBe('FLAGGED');
    expect(result.flagReason).toContain('crosses_midnight');
  });

  it('flags over-max-shift without rejecting', () => {
    const clockIn = new Date('2026-06-19T06:00:00.000Z');
    const clockOut = new Date('2026-06-19T23:30:00.000Z');

    const result = validateClockOut(clockIn, clockOut, 16);

    expect(result.status).toBe('FLAGGED');
    expect(result.flagReason).toContain('exceeds_max_shift');
    expect(computeDurationMinutes(clockIn, clockOut)).toBe(1050);
  });
});

describe('rollUpLaborCost', () => {
  it('rolls up by work order and department', () => {
    const result = rollUpLaborCost(
      [
        {
          employeeId: 'emp-1',
          workOrderId: 'wo-1',
          department: 'Assembly',
          durationMinutes: 120,
        },
        {
          employeeId: 'emp-2',
          workOrderId: 'wo-1',
          department: 'Assembly',
          durationMinutes: 60,
        },
        {
          employeeId: 'emp-1',
          workOrderId: 'wo-2',
          department: 'Paint',
          durationMinutes: 60,
        },
      ],
      { 'emp-1': 30, 'emp-2': 20 },
    );

    const wo1 = result.byWorkOrder.find((r) => r.workOrderId === 'wo-1');
    expect(wo1?.totalMinutes).toBe(180);
    expect(wo1?.totalCost).toBeCloseTo(80);

    const assembly = result.byDepartment.find((r) => r.department === 'Assembly');
    expect(assembly?.totalMinutes).toBe(180);
    expect(assembly?.totalCost).toBeCloseTo(80);
  });
});

describe('isUnavailable', () => {
  it('blocks assignment within an unavailability range', () => {
    const blocked = isUnavailable('emp-1', new Date('2026-06-20'), [
      {
        employeeId: 'emp-1',
        fromDate: new Date('2026-06-18'),
        toDate: new Date('2026-06-22'),
      },
    ]);
    const allowed = isUnavailable('emp-1', new Date('2026-06-25'), [
      {
        employeeId: 'emp-1',
        fromDate: new Date('2026-06-18'),
        toDate: new Date('2026-06-22'),
      },
    ]);

    expect(blocked).toBe(true);
    expect(allowed).toBe(false);
  });
});

describe('employee numbering', () => {
  it('formats EMP-#### sequences', () => {
    expect(formatEmployeeNumber(1)).toBe('EMP-0001');
    expect(parseEmployeeSequence('EMP-0042')).toBe(42);
    expect(parseEmployeeSequence('EMP-SEED1')).toBeNull();
  });

  it('increments from existing numbers', () => {
    expect(
      nextEmployeeNumber(['EMP-0001', 'EMP-0005', 'EMP-SEED1']),
    ).toBe('EMP-0006');
  });
});
