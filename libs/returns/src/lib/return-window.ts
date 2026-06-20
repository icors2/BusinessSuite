export const DEFAULT_RETURN_WINDOW_DAYS = 30;

export function getReturnWindowDays(): number {
  const env = process.env['RETURN_WINDOW_DAYS'];
  if (env) {
    const parsed = parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_RETURN_WINDOW_DAYS;
}

export function isWithinReturnWindow(
  shippedAt: Date,
  now: Date = new Date(),
  windowDays: number = getReturnWindowDays(),
): boolean {
  const elapsedMs = now.getTime() - shippedAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return elapsedDays <= windowDays;
}

export function maxReturnableQty(
  qtyShipped: number,
  qtyAlreadyReturned: number,
): number {
  return Math.max(0, qtyShipped - qtyAlreadyReturned);
}
