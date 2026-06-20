/** Default buffer: trigger is "due soon" when within 10% of threshold (min 1 cycle). */
export function cycleDueSoonBuffer(thresholdCycles: number): number {
  return Math.max(1, Math.floor(thresholdCycles * 0.1));
}

export function shouldTriggerCycle(
  cumulativeCycles: number,
  lastTriggeredCycles: number,
  thresholdCycles: number,
): boolean {
  if (thresholdCycles <= 0) return false;
  return cumulativeCycles >= lastTriggeredCycles + thresholdCycles;
}

export function isCycleDueSoon(
  cumulativeCycles: number,
  lastTriggeredCycles: number,
  thresholdCycles: number,
): boolean {
  if (thresholdCycles <= 0) return false;
  const nextTriggerAt = lastTriggeredCycles + thresholdCycles;
  const buffer = cycleDueSoonBuffer(thresholdCycles);
  return cumulativeCycles >= nextTriggerAt - buffer && cumulativeCycles < nextTriggerAt;
}

export function isCycleOverdue(
  cumulativeCycles: number,
  lastTriggeredCycles: number,
  thresholdCycles: number,
): boolean {
  return shouldTriggerCycle(cumulativeCycles, lastTriggeredCycles, thresholdCycles);
}

export function shouldTriggerCalendar(
  lastTriggeredAt: Date | null | undefined,
  intervalDays: number,
  now: Date = new Date(),
): boolean {
  if (intervalDays <= 0) return false;
  if (!lastTriggeredAt) return true;
  const elapsedMs = now.getTime() - lastTriggeredAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return elapsedDays >= intervalDays;
}

export function isCalendarDueSoon(
  lastTriggeredAt: Date | null | undefined,
  intervalDays: number,
  now: Date = new Date(),
  bufferDays = 3,
): boolean {
  if (intervalDays <= 0) return false;
  const base = lastTriggeredAt ?? now;
  const dueAt = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  const soonAt = new Date(dueAt.getTime() - bufferDays * 24 * 60 * 60 * 1000);
  return now >= soonAt && now < dueAt;
}

export function isCalendarOverdue(
  lastTriggeredAt: Date | null | undefined,
  intervalDays: number,
  now: Date = new Date(),
): boolean {
  return shouldTriggerCalendar(lastTriggeredAt, intervalDays, now);
}

export function isMwoOverdue(
  status: string,
  scheduledDate: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;
  if (!scheduledDate) return false;
  return scheduledDate.getTime() < now.getTime();
}

export function isMwoDueSoon(
  status: string,
  scheduledDate: Date | null | undefined,
  now: Date = new Date(),
  bufferDays = 3,
): boolean {
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;
  if (!scheduledDate) return false;
  const soonAt = new Date(
    scheduledDate.getTime() - bufferDays * 24 * 60 * 60 * 1000,
  );
  return now >= soonAt && now < scheduledDate;
}
