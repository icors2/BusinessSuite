import { MpsStrategy } from '@prisma/client';
import {
  aggregateDemand,
  isoWeekKey,
  monthKey,
  OpenDemandLine,
} from './aggregation';
import { calculateNetDemand } from './net-demand';
import { proposeSchedule } from './scheduling';

function makeLine(
  overrides: Partial<OpenDemandLine> & { salesOrderLineId: string },
): OpenDemandLine {
  return {
    salesOrderLineId: overrides.salesOrderLineId,
    salesOrderId: overrides.salesOrderId ?? 'order-1',
    orderNumber: overrides.orderNumber ?? 'SO-001',
    productId: overrides.productId ?? 'prod-1',
    productSku: overrides.productSku ?? 'SKU-1',
    category: overrides.category ?? 'Widgets',
    mpsStrategy: overrides.mpsStrategy ?? null,
    qty: overrides.qty ?? 10,
    requestedShipDate:
      overrides.requestedShipDate ?? new Date('2026-06-15T00:00:00.000Z'),
  };
}

const resolveWeekly = () => MpsStrategy.WEEKLY;
const resolveMonthly = () => MpsStrategy.MONTHLY;
const resolveBto = () => MpsStrategy.BUILD_TO_ORDER;

describe('aggregation', () => {
  const horizonStart = new Date('2026-06-01T00:00:00.000Z');
  const horizonEnd = new Date('2026-06-30T23:59:59.999Z');

  it('isoWeekKey and monthKey produce expected formats', () => {
    const date = new Date('2026-06-15T00:00:00.000Z');
    expect(isoWeekKey(date)).toMatch(/^\d{4}-W\d{2}$/);
    expect(monthKey(date)).toBe('2026-06');
  });

  it('weekly aggregation combines lines in same week', () => {
    const lines = [
      makeLine({ salesOrderLineId: 'l1', qty: 5 }),
      makeLine({ salesOrderLineId: 'l2', qty: 7 }),
    ];
    const { buckets } = aggregateDemand(
      lines,
      resolveWeekly,
      horizonStart,
      horizonEnd,
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].qty).toBe(12);
    expect(buckets[0].strategy).toBe(MpsStrategy.WEEKLY);
  });

  it('monthly aggregation produces one bucket per product per month', () => {
    const lines = [
      makeLine({
        salesOrderLineId: 'l1',
        qty: 5,
        requestedShipDate: new Date('2026-06-05T00:00:00.000Z'),
      }),
      makeLine({
        salesOrderLineId: 'l2',
        qty: 7,
        requestedShipDate: new Date('2026-06-20T00:00:00.000Z'),
      }),
    ];
    const { buckets } = aggregateDemand(
      lines,
      resolveMonthly,
      horizonStart,
      horizonEnd,
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].periodKey).toBe('2026-06');
    expect(buckets[0].qty).toBe(12);
  });

  it('BTO produces one bucket per sales line', () => {
    const lines = [
      makeLine({ salesOrderLineId: 'l1', qty: 5 }),
      makeLine({ salesOrderLineId: 'l2', qty: 7 }),
    ];
    const { buckets } = aggregateDemand(
      lines,
      resolveBto,
      horizonStart,
      horizonEnd,
    );
    expect(buckets).toHaveLength(2);
    expect(buckets.every((b) => b.strategy === MpsStrategy.BUILD_TO_ORDER)).toBe(
      true,
    );
  });

  it('three strategies produce distinct bucket counts from same input', () => {
    const lines = [
      makeLine({ salesOrderLineId: 'l1', qty: 5 }),
      makeLine({ salesOrderLineId: 'l2', qty: 7 }),
    ];
    const weekly = aggregateDemand(lines, resolveWeekly, horizonStart, horizonEnd)
      .buckets.length;
    const monthly = aggregateDemand(
      lines,
      resolveMonthly,
      horizonStart,
      horizonEnd,
    ).buckets.length;
    const bto = aggregateDemand(lines, resolveBto, horizonStart, horizonEnd)
      .buckets.length;
    expect(weekly).toBe(1);
    expect(monthly).toBe(1);
    expect(bto).toBe(2);
    expect(new Set([weekly, monthly, bto]).size).toBeGreaterThanOrEqual(2);
  });

  it('skips lines without productId', () => {
    const lines = [
      makeLine({ salesOrderLineId: 'l1', productId: '', qty: 5 }),
    ];
    const lineNoProduct = makeLine({ salesOrderLineId: 'l2' });
    (lineNoProduct as { productId: string }).productId = '';
    const { skipped } = aggregateDemand(
      [lineNoProduct],
      resolveWeekly,
      horizonStart,
      horizonEnd,
    );
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain('Missing productId');
  });
});

describe('net demand', () => {
  it('nets out inventory from earliest period and already scheduled', () => {
    const buckets = [
      {
        productId: 'p1',
        productSku: 'SKU-1',
        periodKey: '2026-W24',
        strategy: MpsStrategy.WEEKLY,
        qty: 100,
        demandRefs: ['l1'],
        periodStart: new Date('2026-06-09T00:00:00.000Z'),
      },
      {
        productId: 'p1',
        productSku: 'SKU-1',
        periodKey: '2026-W25',
        strategy: MpsStrategy.WEEKLY,
        qty: 50,
        demandRefs: ['l2'],
        periodStart: new Date('2026-06-16T00:00:00.000Z'),
      },
    ];
    const inventory = new Map([['p1', 30]]);
    const scheduled = new Map([['p1:2026-W24', 20]]);
    const net = calculateNetDemand(buckets, inventory, scheduled);
    expect(net[0].inventoryApplied).toBe(30);
    expect(net[0].alreadyScheduled).toBe(20);
    expect(net[0].netQty).toBe(50);
    expect(net[1].netQty).toBe(50);
  });
});

describe('scheduling', () => {
  const calendarDays = Array.from({ length: 14 }, (_, i) => {
    const date = new Date('2026-06-09T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + i);
    return { date, isWorkingDay: true };
  });

  const lines = [
    { id: 'line-1', code: 'LINE-A', capacityPerDay: 10, active: true },
  ];

  it('flags overload when demand exceeds period capacity', () => {
    const netBuckets = [
      {
        productId: 'p1',
        productSku: 'SKU-1',
        periodKey: '2026-W24',
        strategy: MpsStrategy.WEEKLY,
        qty: 100,
        grossQty: 100,
        availableInventory: 0,
        inventoryApplied: 0,
        alreadyScheduled: 0,
        netQty: 100,
        demandRefs: ['l1'],
        periodStart: new Date('2026-06-09T00:00:00.000Z'),
      },
    ];
    const { overloads, workOrders } = proposeSchedule(
      netBuckets,
      lines,
      calendarDays,
    );
    expect(workOrders).toHaveLength(1);
    expect(overloads.length).toBeGreaterThan(0);
    expect(overloads[0].overloaded).toBe(true);
  });

  it('does not propose work orders when net qty is zero', () => {
    const netBuckets = [
      {
        productId: 'p1',
        productSku: 'SKU-1',
        periodKey: '2026-W24',
        strategy: MpsStrategy.WEEKLY,
        qty: 10,
        grossQty: 10,
        availableInventory: 10,
        inventoryApplied: 10,
        alreadyScheduled: 0,
        netQty: 0,
        demandRefs: ['l1'],
        periodStart: new Date('2026-06-09T00:00:00.000Z'),
      },
    ];
    const { workOrders } = proposeSchedule(netBuckets, lines, calendarDays);
    expect(workOrders).toHaveLength(0);
  });
});
