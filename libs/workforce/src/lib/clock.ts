export const DEFAULT_MAX_SHIFT_HOURS = 16;

export function computeDurationMinutes(clockIn: Date, clockOut: Date): number {
  return Math.max(
    0,
    Math.round((clockOut.getTime() - clockIn.getTime()) / 60000),
  );
}

export function dateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ClockValidationResult {
  durationMinutes: number;
  status: 'CLOSED' | 'FLAGGED';
  flagReason: string | null;
}

export function validateClockOut(
  clockIn: Date,
  clockOut: Date,
  maxShiftHours = DEFAULT_MAX_SHIFT_HOURS,
): ClockValidationResult {
  const durationMinutes = computeDurationMinutes(clockIn, clockOut);
  const reasons: string[] = [];

  if (dateKeyUtc(clockIn) !== dateKeyUtc(clockOut)) {
    reasons.push('crosses_midnight');
  }

  if (durationMinutes > maxShiftHours * 60) {
    reasons.push('exceeds_max_shift');
  }

  if (reasons.length > 0) {
    return {
      durationMinutes,
      status: 'FLAGGED',
      flagReason: reasons.join(';'),
    };
  }

  return {
    durationMinutes,
    status: 'CLOSED',
    flagReason: null,
  };
}
