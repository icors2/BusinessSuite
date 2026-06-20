export interface UnavailabilityRange {
  employeeId: string;
  fromDate: Date;
  toDate: Date;
}

export function normalizeDateUtc(d: Date): Date {
  const normalized = new Date(d);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

export function isUnavailable(
  employeeId: string,
  date: Date,
  unavailabilityRanges: UnavailabilityRange[],
): boolean {
  const target = normalizeDateUtc(date).getTime();

  return unavailabilityRanges.some((range) => {
    if (range.employeeId !== employeeId) {
      return false;
    }
    const from = normalizeDateUtc(range.fromDate).getTime();
    const to = normalizeDateUtc(range.toDate).getTime();
    return target >= from && target <= to;
  });
}
