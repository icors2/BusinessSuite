export function computeCycleDuration(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function computeEfficiency(
  durationMinutes: number,
  standardMinutes: number | null | undefined,
): number | null {
  if (!standardMinutes || standardMinutes <= 0) {
    return null;
  }
  return standardMinutes / durationMinutes;
}

export type OperationStatusValue = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export function canStartOperation(status: OperationStatusValue): boolean {
  return status === 'PENDING';
}

export function allOperationsCompleted(
  statuses: OperationStatusValue[],
): boolean {
  return statuses.length > 0 && statuses.every((s) => s === 'COMPLETED');
}
