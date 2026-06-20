import { ProcurementType } from '@prisma/client';
import {
  aggregateRequirements,
  explodeBom,
  ProductInput,
  WorkOrderInput,
} from './explosion';
import { calculateNetDemand } from './net-demand';
import { computeNeedByDate } from './requisitions';

const productMap = new Map<string, ProductInput>([
  [
    'assembly',
    {
      id: 'assembly',
      sku: 'ASM-001',
      procurementType: ProcurementType.MAKE,
      leadTimeDays: 0,
      preferredVendorId: null,
      vendorLeadTimeDays: 0,
    },
  ],
  [
    'subasm',
    {
      id: 'subasm',
      sku: 'SUB-001',
      procurementType: ProcurementType.MAKE,
      leadTimeDays: 0,
      preferredVendorId: null,
      vendorLeadTimeDays: 0,
    },
  ],
  [
    'buy-part',
    {
      id: 'buy-part',
      sku: 'BUY-001',
      procurementType: ProcurementType.BUY,
      leadTimeDays: 7,
      preferredVendorId: 'vendor-1',
      vendorLeadTimeDays: 5,
    },
  ],
  [
    'buy-bolt',
    {
      id: 'buy-bolt',
      sku: 'BOLT-001',
      procurementType: ProcurementType.BUY,
      leadTimeDays: 3,
      preferredVendorId: null,
      vendorLeadTimeDays: 0,
    },
  ],
]);

const bomMap = new Map([
  [
    'assembly',
    [
      {
        componentProductId: 'subasm',
        quantityPer: 1,
        scrapFactor: 0,
      },
      {
        componentProductId: 'buy-bolt',
        quantityPer: 4,
        scrapFactor: 0.1,
      },
    ],
  ],
  [
    'subasm',
    [
      {
        componentProductId: 'buy-part',
        quantityPer: 2,
        scrapFactor: 0.05,
      },
    ],
  ],
]);

describe('BOM explosion', () => {
  const woStart = new Date('2026-07-01T00:00:00.000Z');
  const workOrders: WorkOrderInput[] = [
    { id: 'wo-1', productId: 'assembly', quantity: 10, scheduledStart: woStart },
  ];

  it('explodes multi-level BOM to BUY leaf components', () => {
    const exploded = explodeBom(workOrders, bomMap, productMap);
    const buyPart = exploded.find((e) => e.productId === 'buy-part');
    const buyBolt = exploded.find((e) => e.productId === 'buy-bolt');

    expect(buyPart).toBeDefined();
    expect(buyPart!.quantity).toBeCloseTo(10 * 2 * 1.05, 4);
    expect(buyPart!.level).toBe(2);

    expect(buyBolt).toBeDefined();
    expect(buyBolt!.quantity).toBeCloseTo(10 * 4 * 1.1, 4);
    expect(buyBolt!.level).toBe(1);
  });

  it('aggregates BUY requirements with need-by dates', () => {
    const exploded = explodeBom(workOrders, bomMap, productMap);
    const aggregated = aggregateRequirements(exploded, computeNeedByDate);

    expect(aggregated.length).toBe(2);
    const partReq = aggregated.find((a) => a.productId === 'buy-part');
    expect(partReq).toBeDefined();
    const expectedNeedBy = computeNeedByDate(woStart, 7);
    expect(partReq!.needByDate.toISOString().slice(0, 10)).toBe(
      expectedNeedBy.toISOString().slice(0, 10),
    );
  });
});

describe('net demand', () => {
  it('nets out inventory and existing pending requisitions', () => {
    const requirements = [
      {
        productId: 'buy-part',
        productSku: 'BUY-001',
        needByDate: new Date('2026-06-24T00:00:00.000Z'),
        grossQty: 100,
        workOrderIds: ['wo-1'],
        leadTimeDays: 7,
        preferredVendorId: 'vendor-1',
      },
    ];
    const inventory = new Map([['buy-part', 30]]);
    const pending = new Map([['buy-part:2026-06-24', 20]]);
    const openPo = new Map<string, number>();

    const net = calculateNetDemand(
      requirements,
      inventory,
      pending,
      openPo,
    );

    expect(net[0].inventoryApplied).toBe(30);
    expect(net[0].existingPending).toBe(20);
    expect(net[0].netQty).toBe(50);
  });
});

describe('need-by back-calculation', () => {
  it('subtracts lead time days from work order start', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const needBy = computeNeedByDate(start, 7);
    expect(needBy.toISOString().slice(0, 10)).toBe('2026-06-24');
  });
});

describe('idempotent re-run simulation', () => {
  it('second run yields zero net when nothing changed', () => {
    const woStart = new Date('2026-07-01T00:00:00.000Z');
    const workOrders: WorkOrderInput[] = [
      { id: 'wo-1', productId: 'assembly', quantity: 10, scheduledStart: woStart },
    ];
    const exploded = explodeBom(workOrders, bomMap, productMap);
    const aggregated = aggregateRequirements(exploded, computeNeedByDate);
    const inventory = new Map<string, number>();
    const openPo = new Map<string, number>();

    const firstNet = calculateNetDemand(
      aggregated,
      inventory,
      new Map(),
      openPo,
    );
    const buyPartFirst = firstNet.find((n) => n.productId === 'buy-part');
    expect(buyPartFirst!.netQty).toBeGreaterThan(0);

    const pending = new Map<string, number>();
    for (const n of firstNet) {
      if (n.netQty > 0) {
        const key = `${n.productId}:${n.needByDate.toISOString().slice(0, 10)}`;
        pending.set(key, n.netQty);
      }
    }

    const secondNet = calculateNetDemand(
      aggregated,
      inventory,
      pending,
      openPo,
    );
    const buyPartSecond = secondNet.find((n) => n.productId === 'buy-part');
    expect(buyPartSecond!.netQty).toBe(0);
  });
});
