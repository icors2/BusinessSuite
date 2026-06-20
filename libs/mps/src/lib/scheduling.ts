import { MpsStrategy } from '@prisma/client';
import {
  periodEndFromKey,
  periodStartFromKey,
} from './aggregation';
import { NetDemandBucket } from './net-demand';

export interface ProductionLineInput {
  id: string;
  code: string;
  capacityPerDay: number;
  active: boolean;
}

export interface CalendarDayInput {
  date: Date;
  isWorkingDay: boolean;
}

export interface ProposedWorkOrder {
  productId: string;
  lineId: string;
  quantity: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  strategy: MpsStrategy;
  periodKey: string;
  demandRefs: string[];
}

export interface CapacitySnapshot {
  periodKey: string;
  lineId: string;
  lineCode: string;
  capacity: number;
  scheduled: number;
  utilization: number;
  overloaded: boolean;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function workingDaysInRange(
  start: Date,
  end: Date,
  calendar: Map<string, boolean>,
): Date[] {
  const days: Date[] = [];
  const cur = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const endUtc = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  while (cur.getTime() <= endUtc.getTime()) {
    const key = dateKey(cur);
    const isWorking = calendar.has(key) ? calendar.get(key)! : true;
    if (isWorking) {
      days.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function addWorkingDays(
  start: Date,
  count: number,
  calendar: Map<string, boolean>,
): Date {
  if (count <= 0) {
    return start;
  }
  let remaining = count;
  const cur = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  while (remaining > 0) {
    const key = dateKey(cur);
    const isWorking = calendar.has(key) ? calendar.get(key)! : true;
    if (isWorking) {
      remaining -= 1;
      if (remaining === 0) {
        return new Date(cur);
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return new Date(cur);
}

function daysNeeded(qty: number, capacityPerDay: number): number {
  if (qty <= 0) {
    return 0;
  }
  if (capacityPerDay <= 0) {
    return 1;
  }
  return Math.ceil(qty / capacityPerDay);
}

export function proposeSchedule(
  netBuckets: NetDemandBucket[],
  lines: ProductionLineInput[],
  calendarDays: CalendarDayInput[],
): {
  workOrders: ProposedWorkOrder[];
  capacity: CapacitySnapshot[];
  overloads: CapacitySnapshot[];
} {
  const activeLines = lines.filter((l) => l.active && l.capacityPerDay > 0);
  const fallbackLines = lines.filter((l) => l.active);
  const usableLines =
    activeLines.length > 0 ? activeLines : fallbackLines;

  const calendar = new Map<string, boolean>();
  for (const day of calendarDays) {
    calendar.set(dateKey(day.date), day.isWorkingDay);
  }

  const loadByPeriodLine = new Map<string, number>();
  const capacityByPeriodLine = new Map<string, CapacitySnapshot>();
  const workOrders: ProposedWorkOrder[] = [];

  for (const bucket of netBuckets) {
    if (bucket.netQty <= 0) {
      continue;
    }

    const periodStart = periodStartFromKey(bucket.periodKey, bucket.strategy);
    const periodEnd = periodEndFromKey(bucket.periodKey, bucket.strategy);
    const workingDays = workingDaysInRange(periodStart, periodEnd, calendar);
    const firstWorkingDay =
      workingDays[0] ??
      new Date(
        Date.UTC(
          periodStart.getUTCFullYear(),
          periodStart.getUTCMonth(),
          periodStart.getUTCDate(),
        ),
      );

    let bestLine = usableLines[0];
    let lowestUtil = Number.POSITIVE_INFINITY;
    for (const line of usableLines) {
      const periodCapacity =
        workingDays.length * line.capacityPerDay;
      const loadKey = `${bucket.periodKey}:${line.id}`;
      const currentLoad = loadByPeriodLine.get(loadKey) ?? 0;
      const util =
        periodCapacity > 0 ? currentLoad / periodCapacity : currentLoad;
      if (util < lowestUtil) {
        lowestUtil = util;
        bestLine = line;
      }
    }

    if (!bestLine) {
      continue;
    }

    const neededDays = daysNeeded(bucket.netQty, bestLine.capacityPerDay);
    const scheduledStart = firstWorkingDay;
    const scheduledEnd = addWorkingDays(
      scheduledStart,
      neededDays,
      calendar,
    );

    workOrders.push({
      productId: bucket.productId,
      lineId: bestLine.id,
      quantity: bucket.netQty,
      scheduledStart,
      scheduledEnd,
      strategy: bucket.strategy,
      periodKey: bucket.periodKey,
      demandRefs: bucket.demandRefs,
    });

    const loadKey = `${bucket.periodKey}:${bestLine.id}`;
    loadByPeriodLine.set(
      loadKey,
      (loadByPeriodLine.get(loadKey) ?? 0) + bucket.netQty,
    );

    const periodCapacity =
      workingDays.length * bestLine.capacityPerDay;
    const scheduled = loadByPeriodLine.get(loadKey) ?? 0;
    const utilization =
      periodCapacity > 0 ? scheduled / periodCapacity : scheduled > 0 ? 999 : 0;

    capacityByPeriodLine.set(loadKey, {
      periodKey: bucket.periodKey,
      lineId: bestLine.id,
      lineCode: bestLine.code,
      capacity: periodCapacity,
      scheduled,
      utilization,
      overloaded: periodCapacity > 0 ? scheduled > periodCapacity : scheduled > 0,
    });
  }

  for (const line of usableLines) {
    const periodKeys = new Set(netBuckets.map((b) => b.periodKey));
    for (const periodKey of periodKeys) {
      const bucket = netBuckets.find((b) => b.periodKey === periodKey);
      if (!bucket) {
        continue;
      }
      const loadKey = `${periodKey}:${line.id}`;
      if (capacityByPeriodLine.has(loadKey)) {
        continue;
      }
      const periodStart = periodStartFromKey(periodKey, bucket.strategy);
      const periodEnd = periodEndFromKey(periodKey, bucket.strategy);
      const workingDays = workingDaysInRange(periodStart, periodEnd, calendar);
      const periodCapacity = workingDays.length * line.capacityPerDay;
      const scheduled = loadByPeriodLine.get(loadKey) ?? 0;
      const utilization =
        periodCapacity > 0 ? scheduled / periodCapacity : 0;
      capacityByPeriodLine.set(loadKey, {
        periodKey,
        lineId: line.id,
        lineCode: line.code,
        capacity: periodCapacity,
        scheduled,
        utilization,
        overloaded: periodCapacity > 0 ? scheduled > periodCapacity : false,
      });
    }
  }

  const capacity = [...capacityByPeriodLine.values()];
  const overloads = capacity.filter((c) => c.overloaded);

  return { workOrders, capacity, overloads };
}
