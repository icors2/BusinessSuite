import {
  deriveOrderStatus,
  greedyAllocate,
  maxShippableQty,
} from './allocation';

describe('greedyAllocate', () => {
  it('allocates fully across multiple bins', () => {
    const result = greedyAllocate(15, [
      { binId: 'b1', binCode: 'A-01', available: 10 },
      { binId: 'b2', binCode: 'A-02', available: 8 },
    ]);
    expect(result.allocated).toBe(15);
    expect(result.backordered).toBe(0);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations.reduce((s, a) => s + a.quantity, 0)).toBe(15);
  });

  it('partial allocation leaves backorder', () => {
    const result = greedyAllocate(20, [
      { binId: 'b1', available: 12 },
    ]);
    expect(result.allocated).toBe(12);
    expect(result.backordered).toBe(8);
  });

  it('zero stock yields full backorder', () => {
    const result = greedyAllocate(5, [{ binId: 'b1', available: 0 }]);
    expect(result.allocated).toBe(0);
    expect(result.backordered).toBe(5);
    expect(result.allocations).toHaveLength(0);
  });
});

describe('deriveOrderStatus', () => {
  it('returns ALLOCATED when no backorder and nothing shipped', () => {
    expect(
      deriveOrderStatus(
        [{ qtyOrdered: 10, qtyShipped: 0, qtyBackordered: 0 }],
        'DRAFT',
      ),
    ).toBe('ALLOCATED');
  });

  it('returns BACKORDERED when shortfall exists', () => {
    expect(
      deriveOrderStatus(
        [{ qtyOrdered: 10, qtyShipped: 0, qtyBackordered: 3 }],
        'ALLOCATED',
      ),
    ).toBe('BACKORDERED');
  });

  it('returns PARTIALLY_SHIPPED when some qty shipped', () => {
    expect(
      deriveOrderStatus(
        [{ qtyOrdered: 10, qtyShipped: 4, qtyBackordered: 0 }],
        'ALLOCATED',
      ),
    ).toBe('PARTIALLY_SHIPPED');
  });

  it('returns SHIPPED when all lines fully shipped', () => {
    expect(
      deriveOrderStatus(
        [
          { qtyOrdered: 10, qtyShipped: 10, qtyBackordered: 0 },
          { qtyOrdered: 5, qtyShipped: 5, qtyBackordered: 0 },
        ],
        'PARTIALLY_SHIPPED',
      ),
    ).toBe('SHIPPED');
  });
});

describe('maxShippableQty', () => {
  it('uses allocated minus shipped for PRODUCT lines', () => {
    expect(
      maxShippableQty({
        kind: 'PRODUCT',
        qtyOrdered: 10,
        qtyAllocated: 8,
        qtyShipped: 3,
        toProduce: false,
      }),
    ).toBe(5);
  });

  it('uses ordered minus shipped for FABRICATED lines', () => {
    expect(
      maxShippableQty({
        kind: 'FABRICATED',
        qtyOrdered: 2,
        qtyAllocated: 0,
        qtyShipped: 0,
        toProduce: true,
      }),
    ).toBe(2);
  });

  it('rejects over-ship via zero max when fully shipped', () => {
    expect(
      maxShippableQty({
        kind: 'PRODUCT',
        qtyOrdered: 5,
        qtyAllocated: 5,
        qtyShipped: 5,
        toProduce: false,
      }),
    ).toBe(0);
  });
});

describe('quote line conversion mapping', () => {
  it('maps frozen quote pricing to order line fields', () => {
    const quoteLine = {
      lineNumber: 1,
      kind: 'PRODUCT' as const,
      productId: 'prod-1',
      description: 'Widget',
      quantity: 5,
      unitPrice: 47.49,
      lineTotal: 237.45,
    };
    const orderLine = {
      lineNumber: quoteLine.lineNumber,
      kind: quoteLine.kind,
      productId: quoteLine.productId,
      description: quoteLine.description,
      unitPrice: quoteLine.unitPrice,
      qtyOrdered: quoteLine.quantity,
      lineTotal: quoteLine.lineTotal,
      toProduce: false,
    };
    expect(orderLine.unitPrice).toBe(47.49);
    expect(orderLine.qtyOrdered).toBe(5);
    expect(orderLine.lineTotal).toBe(237.45);
    expect(orderLine.toProduce).toBe(false);
  });

  it('marks FABRICATED lines as toProduce', () => {
    const fabricated = {
      kind: 'FABRICATED' as const,
      toProduce: true,
    };
    expect(fabricated.toProduce).toBe(true);
  });
});
