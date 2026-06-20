/** Back-calculate need-by date from work order start minus lead time (days). */
export function computeNeedByDate(
  scheduledStart: Date,
  leadTimeDays: number,
): Date {
  const date = new Date(
    Date.UTC(
      scheduledStart.getUTCFullYear(),
      scheduledStart.getUTCMonth(),
      scheduledStart.getUTCDate(),
    ),
  );
  date.setUTCDate(date.getUTCDate() - leadTimeDays);
  return date;
}

export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
