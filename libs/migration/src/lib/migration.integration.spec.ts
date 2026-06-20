import { PrismaClient } from '@prisma/client';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingest } from './runner';
import { reconcile } from './reconcile';
import { promote } from './promote';
import { rollback } from './rollback';

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://anc:anc@localhost:5432/anc_suite?schema=public';

async function isDatabaseAvailable(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch (error) {
    console.warn('Database unavailable for migration integration tests:', error);
    return false;
  }
}

describe('Migration ETL Integration', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });
  let dbAvailable = false;
  let tmp = '';
  const suffix = `${Date.now()}`;
  const source = `test-legacy-${suffix}`;
  const sku = `MIG-SKU-${suffix}`;
  const customerName = `Test Customer One ${suffix}`;
  let batchId = '';

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable(prisma);
    if (!dbAvailable) return;

    tmp = mkdtempSync(join(tmpdir(), 'mig-'));
    writeFileSync(
      join(tmp, 'customers.csv'),
      [
        'sourceId,name,email,billingLine1,billingCity,billingState,billingPostalCode',
        `C1,${customerName},c1@example.com,1 A St,Town,TX,75001`,
        'C2,,no-name@example.com,2 B St,Town,TX,75002',
        'C3,Dup Co,dup@example.com,3 C St,Town,TX,75003',
        'C3,Dup Co Two,dup2@example.com,3 C St,Town,TX,75003',
      ].join('\n'),
    );
    writeFileSync(
      join(tmp, 'products.csv'),
      [
        'sourceId,sku,description,unitOfMeasure,category,inventoryOnHand',
        `P1,${sku},Migrated Bolt,EA,Fasteners,100`,
      ].join('\n'),
    );
  }, 30000);

  afterAll(async () => {
    if (dbAvailable && batchId) {
      // Best-effort cleanup: remove any promoted production rows + batch.
      const staged = await prisma.stagingCustomer.findMany({
        where: { batchId, promotedId: { not: null } },
      });
      for (const s of staged) {
        if (s.promotedId)
          await prisma.customer.deleteMany({ where: { id: s.promotedId } });
      }
      await prisma.product.deleteMany({ where: { sku } });
      await prisma.migrationBatch.delete({ where: { id: batchId } }).catch(() => undefined);
    }
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    await prisma.$disconnect();
  }, 30000);

  it('ingests legacy files into staging with conflict detection', async () => {
    if (!dbAvailable) return;

    const result = await ingest(prisma, source, {
      customer: join(tmp, 'customers.csv'),
      product: join(tmp, 'products.csv'),
    });
    batchId = result.batchId;

    const customerLoad = result.loads.find((l) => l.entity === 'customer');
    expect(customerLoad?.loaded).toBe(4);
    expect(customerLoad?.valid).toBe(1); // C1 valid; C2 missing name; C3 x2 duplicate
    expect(customerLoad?.conflicts).toBe(3);

    const productLoad = result.loads.find((l) => l.entity === 'product');
    expect(productLoad?.valid).toBe(1);
  });

  it('produces a reconciliation report with accurate counts', async () => {
    if (!dbAvailable) return;

    const report = await reconcile(prisma, batchId);
    const customers = report.entities.find((e) => e.entity === 'customer');
    // The two C3 rows collapse to one staging row (upsert on sourceId), both
    // flagged as duplicates; C2 is flagged for the missing name.
    expect(customers?.staged).toBe(3);
    expect(customers?.valid).toBe(1);
    expect(customers?.conflicts).toBe(2);
    expect(report.totals.conflicts).toBeGreaterThanOrEqual(2);
  });

  it('promotes VALID records into production tables', async () => {
    if (!dbAvailable) return;

    const result = await promote(prisma, batchId);
    expect(result.customers.promoted).toBe(1);
    expect(result.products.promoted).toBe(1);

    const product = await prisma.product.findUnique({ where: { sku } });
    expect(product).not.toBeNull();

    const auditEntries = await prisma.auditLog.findMany({
      where: { action: { startsWith: 'migration.promote' }, entityType: 'Product' },
    });
    expect(auditEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('is idempotent — re-ingest + re-promote creates no duplicates', async () => {
    if (!dbAvailable) return;

    await ingest(prisma, source, {
      customer: join(tmp, 'customers.csv'),
      product: join(tmp, 'products.csv'),
    }, { batchId });

    const result = await promote(prisma, batchId);
    // Already-promoted rows stay PROMOTED through re-ingest, so nothing new is
    // promoted and no duplicates are created.
    expect(result.customers.promoted).toBe(0);
    expect(result.products.promoted).toBe(0);

    const customers = await prisma.customer.findMany({
      where: { name: customerName },
    });
    expect(customers.length).toBe(1);
    const products = await prisma.product.findMany({ where: { sku } });
    expect(products.length).toBe(1);
  });

  it('rolls back a promoted batch', async () => {
    if (!dbAvailable) return;

    const result = await rollback(prisma, batchId);
    expect(result.productsDeleted).toBeGreaterThanOrEqual(1);

    const product = await prisma.product.findUnique({ where: { sku } });
    expect(product).toBeNull();

    const staged = await prisma.stagingProduct.findMany({ where: { batchId } });
    expect(staged.every((s) => s.status !== 'PROMOTED')).toBe(true);
  });
});
