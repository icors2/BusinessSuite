import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { WMS_EVENTS } from './events';
import { available, quantityRow, toDecimal } from './inventory-math';
import {
  AdjustInput,
  AllocateInput,
  DeallocateInput,
  MoveInput,
  PickInput,
  ReceiveInput,
  ShipInput,
} from './schemas';

type Tx = Prisma.TransactionClient;

export interface InventoryRowView {
  id: string;
  productId: string;
  binId: string;
  onHand: number;
  allocated: number;
  available: number;
  product?: { id: string; sku: string; description: string };
  bin?: {
    id: string;
    code: string;
    location?: { id: string; code: string; name: string };
  };
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async receive(input: ReceiveInput, actorId?: string) {
    const product = await this.resolveProduct(input);
    const bin = await this.resolveBin(input);

    const result = await this.prisma.$transaction(async (tx) => {
      const qty = await this.applyOnHandDelta(
        tx,
        product.id,
        bin.id,
        toDecimal(input.quantity),
        { allowNegative: false },
      );

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.RECEIPT,
          productId: product.id,
          binId: bin.id,
          quantity: toDecimal(input.quantity),
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { quantity: qty, movement };
    });

    await this.audit.record({
      actorId,
      action: 'receive',
      entityType: 'InventoryQuantity',
      entityId: result.quantity.id,
      metadata: {
        productId: product.id,
        binId: bin.id,
        quantity: input.quantity,
      },
    });

    await this.eventBus.publish(WMS_EVENTS.inventory.received, {
      entityId: result.movement.id,
      actorId,
      payload: {
        productId: product.id,
        binId: bin.id,
        quantity: input.quantity,
        sku: product.sku,
        binCode: bin.code,
      },
    });

    return this.toRowView(result.quantity, product, bin);
  }

  async move(input: MoveInput, actorId?: string) {
    const product = await this.resolveProduct(input);
    const fromBin = await this.resolveBinByRef({
      binId: input.fromBinId,
      binCode: input.fromBinCode,
    });
    const toBin = await this.resolveBinByRef({
      binId: input.toBinId,
      binCode: input.toBinCode,
    });

    if (fromBin.id === toBin.id) {
      throw new BadRequestException('Source and destination bins must differ');
    }

    const qty = toDecimal(input.quantity);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.applyOnHandDelta(tx, product.id, fromBin.id, qty.negated(), {
        allowNegative: false,
      });
      const dest = await this.applyOnHandDelta(tx, product.id, toBin.id, qty, {
        allowNegative: false,
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.PUTAWAY,
          productId: product.id,
          fromBinId: fromBin.id,
          toBinId: toBin.id,
          quantity: qty,
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { dest, movement };
    });

    await this.audit.record({
      actorId,
      action: 'move',
      entityType: 'InventoryMovement',
      entityId: result.movement.id,
      metadata: {
        productId: product.id,
        fromBinId: fromBin.id,
        toBinId: toBin.id,
        quantity: input.quantity,
      },
    });

    await this.eventBus.publish(WMS_EVENTS.inventory.moved, {
      entityId: result.movement.id,
      actorId,
      payload: {
        productId: product.id,
        fromBinId: fromBin.id,
        toBinId: toBin.id,
        quantity: input.quantity,
      },
    });

    return this.toRowView(result.dest, product, toBin);
  }

  async pick(input: PickInput, actorId?: string) {
    const product = await this.resolveProduct(input);
    const bin = await this.resolveBin(input);
    const qty = toDecimal(input.quantity);
    const allowNegative = input.allowNegative ?? false;

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.getOrCreateQuantity(tx, product.id, bin.id);
      const avail = available(current.onHand, current.allocated);

      if (!allowNegative && qty.greaterThan(avail)) {
        throw new BadRequestException(
          `Pick quantity ${input.quantity} exceeds available ${avail.toNumber()}`,
        );
      }

      const updated = await this.applyOnHandDelta(
        tx,
        product.id,
        bin.id,
        qty.negated(),
        { allowNegative },
      );

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.PICK,
          productId: product.id,
          binId: bin.id,
          quantity: qty,
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { updated, movement };
    });

    await this.audit.record({
      actorId,
      action: 'pick',
      entityType: 'InventoryMovement',
      entityId: result.movement.id,
      metadata: { productId: product.id, binId: bin.id, quantity: input.quantity },
    });

    await this.eventBus.publish(WMS_EVENTS.inventory.moved, {
      entityId: result.movement.id,
      actorId,
      payload: {
        productId: product.id,
        binId: bin.id,
        quantity: input.quantity,
        movementType: MovementType.PICK,
      },
    });

    return this.toRowView(result.updated, product, bin);
  }

  async ship(input: ShipInput, actorId?: string) {
    const product = await this.resolveProduct(input);
    const bin = await this.resolveBin(input);
    const qty = toDecimal(input.quantity);
    const allowNegative = input.allowNegative ?? false;

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.getOrCreateQuantity(tx, product.id, bin.id);

      if (!allowNegative && qty.greaterThan(current.onHand)) {
        throw new BadRequestException(
          `Ship quantity ${input.quantity} exceeds on-hand ${current.onHand.toNumber()}`,
        );
      }

      const newOnHand = current.onHand.minus(qty);
      const deallocated = Decimal.min(qty, current.allocated);
      const newAllocated = current.allocated.minus(deallocated);

      if (!allowNegative && newOnHand.lessThan(newAllocated)) {
        throw new BadRequestException(
          'Ship would leave allocated exceeding on-hand',
        );
      }

      const updated = await tx.inventoryQuantity.update({
        where: { id: current.id },
        data: { onHand: newOnHand, allocated: newAllocated },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.SHIP,
          productId: product.id,
          binId: bin.id,
          quantity: qty,
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { updated, movement };
    });

    await this.audit.record({
      actorId,
      action: 'ship',
      entityType: 'InventoryMovement',
      entityId: result.movement.id,
      metadata: { productId: product.id, binId: bin.id, quantity: input.quantity },
    });

    await this.eventBus.publish(WMS_EVENTS.inventory.shipped, {
      entityId: result.movement.id,
      actorId,
      payload: {
        productId: product.id,
        binId: bin.id,
        quantity: input.quantity,
      },
    });

    return this.toRowView(result.updated, product, bin);
  }

  async adjust(input: AdjustInput, actorId?: string) {
    if (!input.reasonCode?.trim()) {
      throw new BadRequestException('reasonCode is required for adjustments');
    }

    const product = await this.resolveProduct(input);
    const bin = await this.resolveBin(input);
    const delta = toDecimal(input.quantityDelta);
    const allowNegative = input.allowNegative ?? false;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await this.applyOnHandDelta(
        tx,
        product.id,
        bin.id,
        delta,
        { allowNegative },
      );

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.ADJUST,
          productId: product.id,
          binId: bin.id,
          quantity: delta.abs(),
          reasonCode: input.reasonCode.trim(),
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { updated, movement };
    });

    await this.audit.record({
      actorId,
      action: 'adjust',
      entityType: 'InventoryMovement',
      entityId: result.movement.id,
      metadata: {
        productId: product.id,
        binId: bin.id,
        quantityDelta: input.quantityDelta,
        reasonCode: input.reasonCode,
      },
    });

    await this.eventBus.publish(WMS_EVENTS.inventory.adjusted, {
      entityId: result.movement.id,
      actorId,
      payload: {
        productId: product.id,
        binId: bin.id,
        quantityDelta: input.quantityDelta,
        reasonCode: input.reasonCode,
      },
    });

    return this.toRowView(result.updated, product, bin);
  }

  async allocate(input: AllocateInput, actorId?: string) {
    const product = await this.resolveProduct(input);
    const bin = await this.resolveBin(input);
    const qty = toDecimal(input.quantity);

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.getOrCreateQuantity(tx, product.id, bin.id);
      const avail = available(current.onHand, current.allocated);

      if (qty.greaterThan(avail)) {
        throw new BadRequestException(
          `Allocate quantity ${input.quantity} exceeds available ${avail.toNumber()}`,
        );
      }

      const updated = await tx.inventoryQuantity.update({
        where: { id: current.id },
        data: { allocated: current.allocated.plus(qty) },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.ALLOCATE,
          productId: product.id,
          binId: bin.id,
          quantity: qty,
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { updated, movement };
    });

    await this.audit.record({
      actorId,
      action: 'allocate',
      entityType: 'InventoryMovement',
      entityId: result.movement.id,
      metadata: { productId: product.id, binId: bin.id, quantity: input.quantity },
    });

    return this.toRowView(result.updated, product, bin);
  }

  async deallocate(input: DeallocateInput, actorId?: string) {
    const product = await this.resolveProduct(input);
    const bin = await this.resolveBin(input);
    const qty = toDecimal(input.quantity);

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.getOrCreateQuantity(tx, product.id, bin.id);

      if (qty.greaterThan(current.allocated)) {
        throw new BadRequestException(
          `Deallocate quantity ${input.quantity} exceeds allocated ${current.allocated.toNumber()}`,
        );
      }

      const updated = await tx.inventoryQuantity.update({
        where: { id: current.id },
        data: { allocated: current.allocated.minus(qty) },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          type: MovementType.DEALLOCATE,
          productId: product.id,
          binId: bin.id,
          quantity: qty,
          note: input.note?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      return { updated, movement };
    });

    await this.audit.record({
      actorId,
      action: 'deallocate',
      entityType: 'InventoryMovement',
      entityId: result.movement.id,
      metadata: { productId: product.id, binId: bin.id, quantity: input.quantity },
    });

    return this.toRowView(result.updated, product, bin);
  }

  async lookupByProduct(input: { productId?: string; sku?: string }) {
    const product = await this.resolveProduct(input);
    const rows = await this.prisma.inventoryQuantity.findMany({
      where: { productId: product.id },
      include: {
        product: true,
        bin: { include: { location: true } },
      },
      orderBy: { bin: { code: 'asc' } },
    });

    return {
      product,
      items: rows.map((row) => this.toRowView(row, row.product, row.bin)),
      totals: this.sumRows(rows),
    };
  }

  async lookupByBin(input: { binId?: string; binCode?: string }) {
    const bin = await this.resolveBinByRef(input);
    const rows = await this.prisma.inventoryQuantity.findMany({
      where: { binId: bin.id },
      include: {
        product: true,
        bin: { include: { location: true } },
      },
      orderBy: { product: { sku: 'asc' } },
    });

    return {
      bin,
      items: rows.map((row) => this.toRowView(row, row.product, row.bin)),
      totals: this.sumRows(rows),
    };
  }

  async lookupByLocation(input: {
    locationId?: string;
    locationCode?: string;
  }) {
    const location = input.locationId
      ? await this.prisma.location.findUnique({ where: { id: input.locationId } })
      : await this.prisma.location.findFirst({
          where: {
            code: input.locationCode!.trim().toUpperCase(),
            active: true,
          },
        });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const rows = await this.prisma.inventoryQuantity.findMany({
      where: { bin: { locationId: location.id } },
      include: {
        product: true,
        bin: { include: { location: true } },
      },
      orderBy: [{ bin: { code: 'asc' } }, { product: { sku: 'asc' } }],
    });

    return {
      location,
      items: rows.map((row) => this.toRowView(row, row.product, row.bin)),
      totals: this.sumRows(rows),
    };
  }

  private async applyOnHandDelta(
    tx: Tx,
    productId: string,
    binId: string,
    delta: Decimal,
    options: { allowNegative: boolean },
  ) {
    const current = await this.getOrCreateQuantity(tx, productId, binId);
    const newOnHand = current.onHand.plus(delta);

    if (!options.allowNegative && newOnHand.lessThan(0)) {
      throw new BadRequestException(
        `Operation would result in negative on-hand (${newOnHand.toNumber()})`,
      );
    }

    if (!options.allowNegative && newOnHand.lessThan(current.allocated)) {
      throw new BadRequestException(
        'Operation would leave allocated exceeding on-hand',
      );
    }

    return tx.inventoryQuantity.update({
      where: { id: current.id },
      data: { onHand: newOnHand },
    });
  }

  private async getOrCreateQuantity(tx: Tx, productId: string, binId: string) {
    const existing = await tx.inventoryQuantity.findUnique({
      where: { productId_binId: { productId, binId } },
    });
    if (existing) {
      return existing;
    }
    return tx.inventoryQuantity.create({
      data: { productId, binId, onHand: 0, allocated: 0 },
    });
  }

  private async resolveProduct(input: { productId?: string; sku?: string }) {
    if (input.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: input.productId, deletedAt: null, active: true },
      });
      if (!product) {
        throw new NotFoundException(`Product ${input.productId} not found`);
      }
      return product;
    }

    const sku = input.sku!.trim();
    const product = await this.prisma.product.findFirst({
      where: {
        sku: { equals: sku, mode: 'insensitive' },
        deletedAt: null,
        active: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product SKU ${sku} not found`);
    }
    return product;
  }

  private async resolveBin(input: { binId?: string; binCode?: string }) {
    return this.resolveBinByRef(input);
  }

  private async resolveBinByRef(input: {
    binId?: string;
    binCode?: string;
  }) {
    if (input.binId) {
      const bin = await this.prisma.bin.findFirst({
        where: { id: input.binId, active: true },
        include: { location: true },
      });
      if (!bin) {
        throw new NotFoundException(`Bin ${input.binId} not found`);
      }
      return bin;
    }

    const code = input.binCode!.trim().toUpperCase();
    const bin = await this.prisma.bin.findFirst({
      where: { code: { equals: code, mode: 'insensitive' }, active: true },
      include: { location: true },
    });
    if (!bin) {
      throw new NotFoundException(`Bin ${code} not found`);
    }
    return bin;
  }

  private sumRows(
    rows: Array<{ onHand: Decimal; allocated: Decimal }>,
  ) {
    const onHand = rows.reduce(
      (sum, row) => sum.plus(row.onHand),
      new Decimal(0),
    );
    const allocated = rows.reduce(
      (sum, row) => sum.plus(row.allocated),
      new Decimal(0),
    );
    return quantityRow(onHand, allocated);
  }

  private toRowView(
    row: { id: string; productId: string; binId: string; onHand: Decimal; allocated: Decimal },
    product?: { id: string; sku: string; description: string },
    bin?: {
      id: string;
      code: string;
      location?: { id: string; code: string; name: string };
    },
  ): InventoryRowView {
    const amounts = quantityRow(row.onHand, row.allocated);
    return {
      id: row.id,
      productId: row.productId,
      binId: row.binId,
      ...amounts,
      ...(product
        ? {
            product: {
              id: product.id,
              sku: product.sku,
              description: product.description,
            },
          }
        : {}),
      ...(bin
        ? {
            bin: {
              id: bin.id,
              code: bin.code,
              ...(bin.location
                ? {
                    location: {
                      id: bin.location.id,
                      code: bin.location.code,
                      name: bin.location.name,
                    },
                  }
                : {}),
            },
          }
        : {}),
    };
  }
}
