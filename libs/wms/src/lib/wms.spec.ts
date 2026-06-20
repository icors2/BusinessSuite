import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { available, quantityRow } from './inventory-math';
import { InventoryService } from './inventory.service';

describe('inventory math', () => {
  it('computes available as onHand minus allocated', () => {
    expect(available(new Decimal(10), new Decimal(3)).toNumber()).toBe(7);
    expect(quantityRow(new Decimal(10), new Decimal(3)).available).toBe(7);
  });
});

describe('InventoryService movements', () => {
  interface QtyRow {
    id: string;
    productId: string;
    binId: string;
    onHand: Decimal;
    allocated: Decimal;
  }

  const qtyStore = new Map<string, QtyRow>();
  let idCounter = 0;

  function key(productId: string, binId: string) {
    return `${productId}:${binId}`;
  }

  const prismaMock: Record<string, unknown> = {};
  Object.assign(prismaMock, {
    product: {
      findFirst: jest.fn(async () => ({
        id: 'prod-1',
        sku: 'SKU-001',
        description: 'Test',
        active: true,
      })),
    },
    bin: {
      findFirst: jest.fn(async ({ where }: { where: { id?: string } }) => {
        if (where.id === 'bin-2') {
          return {
            id: 'bin-2',
            code: 'A-01-02',
            active: true,
            location: { id: 'loc-1', code: 'MAIN', name: 'Main' },
          };
        }
        return {
          id: where.id ?? 'bin-1',
          code: 'A-01-01',
          active: true,
          location: { id: 'loc-1', code: 'MAIN', name: 'Main' },
        };
      }),
    },
    location: { findUnique: jest.fn(), findFirst: jest.fn() },
    inventoryQuantity: {
      findUnique: jest.fn(async ({
        where,
      }: {
        where: { productId_binId: { productId: string; binId: string } };
      }) => {
        return (
          qtyStore.get(
            key(where.productId_binId.productId, where.productId_binId.binId),
          ) ?? null
        );
      }),
      findMany: jest.fn(),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { productId: string; binId: string };
        }) => {
          const row: QtyRow = {
            id: `qty-${++idCounter}`,
            productId: data.productId,
            binId: data.binId,
            onHand: new Decimal(0),
            allocated: new Decimal(0),
          };
          qtyStore.set(key(data.productId, data.binId), row);
          return row;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { onHand?: Decimal; allocated?: Decimal };
        }) => {
          const row = [...qtyStore.values()].find((r) => r.id === where.id);
          if (!row) throw new Error('not found');
          if (data.onHand !== undefined) row.onHand = data.onHand;
          if (data.allocated !== undefined) row.allocated = data.allocated;
          return { ...row };
        },
      ),
    },
    inventoryMovement: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `mov-${++idCounter}`,
        ...data,
      })),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn(prismaMock),
    ),
  });

  const audit = { record: jest.fn() };
  const eventBus = { publish: jest.fn() };

  const service = new InventoryService(
    prismaMock as never,
    audit as never,
    eventBus as never,
  );

  beforeEach(() => {
    qtyStore.clear();
    idCounter = 0;
    jest.clearAllMocks();
  });

  async function seedQty(onHand: number, allocated: number) {
    qtyStore.set('prod-1:bin-1', {
      id: 'qty-1',
      productId: 'prod-1',
      binId: 'bin-1',
      onHand: new Decimal(onHand),
      allocated: new Decimal(allocated),
    });
  }

  it('rejects pick beyond available without override', async () => {
    await seedQty(10, 5);

    await expect(
      service.pick({
        productId: 'prod-1',
        binId: 'bin-1',
        quantity: 6,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows pick with allowNegative override', async () => {
    await seedQty(10, 5);

    const result = await service.pick({
      productId: 'prod-1',
      binId: 'bin-1',
      quantity: 6,
      allowNegative: true,
    });

    expect(result.onHand).toBe(4);
    expect(result.available).toBe(-1);
  });

  it('requires reasonCode for adjust', async () => {
    await seedQty(10, 0);

    await expect(
      service.adjust({
        productId: 'prod-1',
        binId: 'bin-1',
        quantityDelta: -1,
        reasonCode: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('move decrements source and increments destination', async () => {
    await seedQty(10, 0);
    qtyStore.set('prod-1:bin-2', {
      id: 'qty-2',
      productId: 'prod-1',
      binId: 'bin-2',
      onHand: new Decimal(2),
      allocated: new Decimal(0),
    });

    await service.move({
      productId: 'prod-1',
      fromBinId: 'bin-1',
      toBinId: 'bin-2',
      quantity: 4,
    });

    expect(qtyStore.get('prod-1:bin-1')!.onHand.toNumber()).toBe(6);
    expect(qtyStore.get('prod-1:bin-2')!.onHand.toNumber()).toBe(6);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'wms.inventory.moved',
      expect.any(Object),
    );
  });
});
