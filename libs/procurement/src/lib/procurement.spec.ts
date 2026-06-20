import { consolidateRequisitions } from './consolidation';
import { formatPoNumber, parsePoSequence } from './numbering';
import { computeScorecard } from './scorecard';

describe('consolidateRequisitions', () => {
  it('groups multiple approved reqs for one vendor into a single PO draft', () => {
    const result = consolidateRequisitions([
      {
        id: 'req-1',
        componentProductId: 'prod-a',
        componentSku: 'SKU-A',
        componentDescription: 'Part A',
        quantity: 10,
        needByDate: new Date('2026-07-01'),
        preferredVendorId: 'vendor-1',
        listPrice: 5,
      },
      {
        id: 'req-2',
        componentProductId: 'prod-b',
        componentSku: 'SKU-B',
        componentDescription: 'Part B',
        quantity: 20,
        needByDate: new Date('2026-07-05'),
        preferredVendorId: 'vendor-1',
        listPrice: 2,
      },
    ]);

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].vendorId).toBe('vendor-1');
    expect(result.drafts[0].lines).toHaveLength(2);
    expect(result.drafts[0].expectedDeliveryDate?.toISOString().slice(0, 10)).toBe(
      '2026-07-01',
    );
    expect(result.skipped).toHaveLength(0);
  });

  it('creates separate PO drafts for different vendors', () => {
    const result = consolidateRequisitions([
      {
        id: 'req-1',
        componentProductId: 'prod-a',
        componentSku: 'SKU-A',
        componentDescription: 'Part A',
        quantity: 10,
        needByDate: new Date('2026-07-01'),
        preferredVendorId: 'vendor-1',
        listPrice: 5,
      },
      {
        id: 'req-2',
        componentProductId: 'prod-b',
        componentSku: 'SKU-B',
        componentDescription: 'Part B',
        quantity: 20,
        needByDate: new Date('2026-07-05'),
        preferredVendorId: 'vendor-2',
        listPrice: 2,
      },
    ]);

    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.map((d) => d.vendorId).sort()).toEqual([
      'vendor-1',
      'vendor-2',
    ]);
  });

  it('skips requisitions without a preferred vendor', () => {
    const result = consolidateRequisitions([
      {
        id: 'req-1',
        componentProductId: 'prod-a',
        componentSku: 'SKU-A',
        componentDescription: 'Part A',
        quantity: 10,
        needByDate: new Date('2026-07-01'),
        preferredVendorId: null,
        listPrice: 5,
      },
    ]);

    expect(result.drafts).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});

describe('computeScorecard', () => {
  it('computes on-time and quantity-accuracy rates', () => {
    const metrics = computeScorecard(
      [
        {
          lineId: 'line-1',
          productId: 'prod-a',
          orderedQty: 100,
          qtyReceived: 100,
          expectedDeliveryDate: new Date('2026-07-10'),
          receipts: [
            {
              quantity: 60,
              receivedAt: new Date('2026-07-08'),
            },
            {
              quantity: 40,
              receivedAt: new Date('2026-07-12'),
            },
          ],
        },
        {
          lineId: 'line-2',
          productId: 'prod-b',
          orderedQty: 50,
          qtyReceived: 45,
          expectedDeliveryDate: new Date('2026-07-15'),
          receipts: [
            {
              quantity: 45,
              receivedAt: new Date('2026-07-14'),
            },
          ],
        },
      ],
      {
        from: new Date('2026-07-01'),
        to: new Date('2026-07-31'),
      },
    );

    expect(metrics.totalReceipts).toBe(3);
    expect(metrics.onTimeReceipts).toBe(2);
    expect(metrics.onTimeRate).toBeCloseTo(2 / 3, 4);
    expect(metrics.receivedLines).toBe(2);
    expect(metrics.quantityAccurateLines).toBe(1);
    expect(metrics.quantityAccuracyRate).toBe(0.5);
  });
});

describe('PO numbering', () => {
  it('formats and parses PO numbers', () => {
    expect(formatPoNumber(2026, 1)).toBe('PO-2026-0001');
    expect(parsePoSequence('PO-2026-0042', 2026)).toBe(42);
    expect(parsePoSequence('PO-2025-0001', 2026)).toBeNull();
  });
});
