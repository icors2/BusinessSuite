export function avgDailyDemand(totalQty: number, windowDays: number): number {
  if (windowDays <= 0 || totalQty <= 0) return 0;
  return totalQty / windowDays;
}

export function projectDepletion(
  onHand: number,
  avgDaily: number,
  asOf: Date,
): Date | null {
  if (avgDaily <= 0 || onHand <= 0) return null;
  const days = Math.ceil(onHand / avgDaily);
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function recommendedReorder(
  depletionDate: Date | null,
  leadTimeDays: number,
): Date | null {
  if (!depletionDate) return null;
  const d = new Date(depletionDate);
  d.setUTCDate(d.getUTCDate() - Math.max(0, leadTimeDays));
  return d;
}
