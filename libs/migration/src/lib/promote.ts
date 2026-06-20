import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Promote step: copy VALID staging records into the production Master Data
 * tables. Idempotent — a staging record already carrying a promotedId is
 * skipped, and products promote via SKU upsert, so re-running never duplicates.
 *
 * Quotes have no production model until Phase 6 (CPQ) and inventory balances
 * until Phase 5 (WMS); those staging rows are marked SKIPPED with a forward
 * reference rather than promoted.
 */

export interface PromoteResult {
  customers: { promoted: number; skipped: number };
  vendors: { promoted: number; skipped: number };
  products: { promoted: number; skipped: number };
  quotes: { held: number };
}

async function audit(
  prisma: PrismaClient,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function promote(
  prisma: PrismaClient,
  batchId: string,
): Promise<PromoteResult> {
  const result: PromoteResult = {
    customers: { promoted: 0, skipped: 0 },
    vendors: { promoted: 0, skipped: 0 },
    products: { promoted: 0, skipped: 0 },
    quotes: { held: 0 },
  };

  // Customers
  const customers = await prisma.stagingCustomer.findMany({
    where: { batchId, status: 'VALID' },
  });
  for (const c of customers) {
    if (c.promotedId) {
      result.customers.skipped++;
      continue;
    }
    const created = await prisma.customer.create({
      data: {
        name: c.name ?? 'UNKNOWN',
        email: c.email,
        phone: c.phone,
        billingAddress: (c.billingAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        shippingAddress: (c.shippingAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        creditTerms: c.creditTerms,
      },
    });
    await prisma.stagingCustomer.update({
      where: { id: c.id },
      data: { status: 'PROMOTED', promotedId: created.id },
    });
    await audit(prisma, 'migration.promote', 'Customer', created.id, {
      batchId,
      sourceSystem: c.sourceSystem,
      sourceId: c.sourceId,
    });
    result.customers.promoted++;
  }

  // Vendors
  const vendors = await prisma.stagingVendor.findMany({
    where: { batchId, status: 'VALID' },
  });
  for (const v of vendors) {
    if (v.promotedId) {
      result.vendors.skipped++;
      continue;
    }
    const created = await prisma.vendor.create({
      data: {
        name: v.name ?? 'UNKNOWN',
        email: v.email,
        phone: v.phone,
        address: (v.address ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        paymentTerms: v.paymentTerms,
      },
    });
    await prisma.stagingVendor.update({
      where: { id: v.id },
      data: { status: 'PROMOTED', promotedId: created.id },
    });
    await audit(prisma, 'migration.promote', 'Vendor', created.id, {
      batchId,
      sourceSystem: v.sourceSystem,
      sourceId: v.sourceId,
    });
    result.vendors.promoted++;
  }

  // Products — upsert by SKU so re-runs and overlapping batches converge.
  const products = await prisma.stagingProduct.findMany({
    where: { batchId, status: 'VALID' },
  });
  for (const p of products) {
    if (p.promotedId) {
      result.products.skipped++;
      continue;
    }
    if (!p.sku) {
      result.products.skipped++;
      continue;
    }
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    const upserted = await prisma.product.upsert({
      where: { sku: p.sku },
      create: {
        sku: p.sku,
        description: p.description ?? '',
        unitOfMeasure: p.unitOfMeasure ?? 'EA',
        category: p.category,
      },
      update: {
        description: p.description ?? undefined,
        unitOfMeasure: p.unitOfMeasure ?? undefined,
        category: p.category,
      },
    });
    await prisma.stagingProduct.update({
      where: { id: p.id },
      data: { status: 'PROMOTED', promotedId: upserted.id },
    });
    await audit(
      prisma,
      existing ? 'migration.promote.update' : 'migration.promote',
      'Product',
      upserted.id,
      {
        batchId,
        sourceSystem: p.sourceSystem,
        sourceId: p.sourceId,
        sku: p.sku,
        inventoryOnHand: p.inventoryOnHand,
        note: 'inventory balance staged for Phase 5 (WMS)',
      },
    );
    result.products.promoted++;
  }

  // Quotes — no production model yet (Phase 6 CPQ). Hold in staging.
  const quotes = await prisma.stagingQuote.updateMany({
    where: { batchId, status: 'VALID' },
    data: { status: 'SKIPPED', conflictReason: 'Held for Phase 6 (CPQ) — no production Quote model yet' },
  });
  result.quotes.held = quotes.count;

  await prisma.migrationBatch.update({
    where: { id: batchId },
    data: { status: 'PROMOTED' },
  });

  return result;
}
