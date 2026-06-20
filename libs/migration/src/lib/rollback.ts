import { PrismaClient } from '@prisma/client';

/**
 * Rollback step: undo a promoted batch. Deletes the production Master Data
 * records this batch created (tracked via staging.promotedId) and resets staging
 * rows to VALID so the batch can be re-reviewed or re-promoted.
 *
 * Products are upserted by SKU during promote, so a product whose SKU pre-dated
 * this batch is NOT deleted unless it was newly created by this batch. We only
 * delete records whose promotedId is owned by this batch's staging rows.
 *
 * This is a best-effort logical rollback for a freshly promoted batch. For a
 * full system-level revert, use the database restore path in the cutover
 * runbook (point-in-time restore of the pre-cutover snapshot).
 */

export interface RollbackResult {
  customersDeleted: number;
  vendorsDeleted: number;
  productsDeleted: number;
}

export async function rollback(
  prisma: PrismaClient,
  batchId: string,
): Promise<RollbackResult> {
  const result: RollbackResult = {
    customersDeleted: 0,
    vendorsDeleted: 0,
    productsDeleted: 0,
  };

  const customers = await prisma.stagingCustomer.findMany({
    where: { batchId, status: 'PROMOTED', promotedId: { not: null } },
  });
  for (const c of customers) {
    if (c.promotedId) {
      await prisma.customer.deleteMany({ where: { id: c.promotedId } });
      result.customersDeleted++;
    }
    await prisma.stagingCustomer.update({
      where: { id: c.id },
      data: { status: 'VALID', promotedId: null },
    });
  }

  const vendors = await prisma.stagingVendor.findMany({
    where: { batchId, status: 'PROMOTED', promotedId: { not: null } },
  });
  for (const v of vendors) {
    if (v.promotedId) {
      await prisma.vendor.deleteMany({ where: { id: v.promotedId } });
      result.vendorsDeleted++;
    }
    await prisma.stagingVendor.update({
      where: { id: v.id },
      data: { status: 'VALID', promotedId: null },
    });
  }

  const products = await prisma.stagingProduct.findMany({
    where: { batchId, status: 'PROMOTED', promotedId: { not: null } },
  });
  for (const p of products) {
    if (p.promotedId) {
      await prisma.product.deleteMany({ where: { id: p.promotedId } });
      result.productsDeleted++;
    }
    await prisma.stagingProduct.update({
      where: { id: p.id },
      data: { status: 'VALID', promotedId: null },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'migration.rollback',
      entityType: 'MigrationBatch',
      entityId: batchId,
      metadata: result as unknown as Record<string, never>,
    },
  });

  await prisma.migrationBatch.update({
    where: { id: batchId },
    data: { status: 'ROLLED_BACK' },
  });

  return result;
}
