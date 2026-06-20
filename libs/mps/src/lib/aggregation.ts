import { MpsStrategy } from '@prisma/client';

export interface OpenDemandLine {
  salesOrderLineId: string;
  salesOrderId: string;
  orderNumber: string;
  productId: string;
  productSku: string;
  category: string | null;
  mpsStrategy: MpsStrategy | null;
  qty: number;
  requestedShipDate: Date | null;
}

export interface DemandBucket {
  productId: string;
  productSku: string;
  periodKey: string;
  strategy: MpsStrategy;
  qty: number;
  demandRefs: string[];
  periodStart: Date;
}

export interface SkippedDemandLine {
  salesOrderLineId: string;
  orderNumber: string;
  reason: string;
}

/** ISO week key e.g. 2026-W25 */
export function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Month key e.g. 2026-06 */
export function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Monday of ISO week from key 2026-W25 */
export function weekStartFromKey(periodKey: string): Date {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  if (!match) {
    throw new Error(`Invalid week period key: ${periodKey}`);
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
}

/** First day of month from key 2026-06 */
export function monthStartFromKey(periodKey: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) {
    throw new Error(`Invalid month period key: ${periodKey}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export function periodStartFromKey(
  periodKey: string,
  strategy: MpsStrategy,
): Date {
  if (strategy === MpsStrategy.BUILD_TO_ORDER) {
    const datePart = periodKey.replace(/^BTO:/, '').split(':')[0];
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }
    return new Date();
  }
  if (strategy === MpsStrategy.WEEKLY) {
    return weekStartFromKey(periodKey);
  }
  return monthStartFromKey(periodKey);
}

export function periodEndFromKey(
  periodKey: string,
  strategy: MpsStrategy,
): Date {
  const start = periodStartFromKey(periodKey, strategy);
  if (strategy === MpsStrategy.BUILD_TO_ORDER) {
    return new Date(start);
  }
  if (strategy === MpsStrategy.WEEKLY) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return end;
  }
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );
  return end;
}

function effectiveShipDate(line: OpenDemandLine): Date {
  return line.requestedShipDate ?? new Date();
}

function inHorizon(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function aggregateDemand(
  lines: OpenDemandLine[],
  resolveStrategy: (line: OpenDemandLine) => MpsStrategy,
  horizonStart: Date,
  horizonEnd: Date,
): { buckets: DemandBucket[]; skipped: SkippedDemandLine[] } {
  const bucketMap = new Map<string, DemandBucket>();
  const skipped: SkippedDemandLine[] = [];

  for (const line of lines) {
    if (!line.productId) {
      skipped.push({
        salesOrderLineId: line.salesOrderLineId,
        orderNumber: line.orderNumber,
        reason: 'Missing productId (FABRICATED line without product link)',
      });
      continue;
    }

    if (line.qty <= 0) {
      continue;
    }

    const shipDate = effectiveShipDate(line);
    if (!inHorizon(shipDate, horizonStart, horizonEnd)) {
      skipped.push({
        salesOrderLineId: line.salesOrderLineId,
        orderNumber: line.orderNumber,
        reason: 'Requested ship date outside planning horizon',
      });
      continue;
    }

    const strategy = resolveStrategy(line);
    let periodKey: string;
    let periodStart: Date;

    if (strategy === MpsStrategy.BUILD_TO_ORDER) {
      const dateStr = shipDate.toISOString().slice(0, 10);
      periodKey = `BTO:${dateStr}:${line.salesOrderLineId}`;
      periodStart = new Date(
        Date.UTC(
          shipDate.getUTCFullYear(),
          shipDate.getUTCMonth(),
          shipDate.getUTCDate(),
        ),
      );
    } else if (strategy === MpsStrategy.WEEKLY) {
      periodKey = isoWeekKey(shipDate);
      periodStart = weekStartFromKey(periodKey);
    } else {
      periodKey = monthKey(shipDate);
      periodStart = monthStartFromKey(periodKey);
    }

    const mapKey = `${line.productId}:${periodKey}:${strategy}`;
    const existing = bucketMap.get(mapKey);
    if (existing) {
      existing.qty += line.qty;
      existing.demandRefs.push(line.salesOrderLineId);
    } else {
      bucketMap.set(mapKey, {
        productId: line.productId,
        productSku: line.productSku,
        periodKey,
        strategy,
        qty: line.qty,
        demandRefs: [line.salesOrderLineId],
        periodStart,
      });
    }
  }

  const buckets = [...bucketMap.values()].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );
  return { buckets, skipped };
}
