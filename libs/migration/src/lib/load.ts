import { PrismaClient, Prisma } from '@prisma/client';
import { MigrationEntity } from './expected-schemas';
import { TransformResult } from './transform';

/**
 * Load step: write transformed records into the staging tables. Loading is
 * idempotent — records are upserted on (sourceSystem, sourceId), so re-running a
 * batch overwrites the prior staging copy rather than duplicating it.
 *
 * Nothing is written to production Master Data tables here; that only happens in
 * the promote step, after an operator has reviewed the reconciliation report.
 */

export interface LoadResult {
  entity: MigrationEntity;
  loaded: number;
  valid: number;
  conflicts: number;
}

const jsonOrNull = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === undefined || value === null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);

type StagingDelegate = {
  findMany: (args: unknown) => Promise<{ sourceId: string }[]>;
};

function delegateFor(
  prisma: PrismaClient,
  entity: MigrationEntity,
): StagingDelegate {
  switch (entity) {
    case 'customer':
      return prisma.stagingCustomer as unknown as StagingDelegate;
    case 'vendor':
      return prisma.stagingVendor as unknown as StagingDelegate;
    case 'product':
      return prisma.stagingProduct as unknown as StagingDelegate;
    case 'quote':
      return prisma.stagingQuote as unknown as StagingDelegate;
  }
}

export async function loadStaging(
  prisma: PrismaClient,
  batchId: string,
  sourceSystem: string,
  result: TransformResult,
): Promise<LoadResult> {
  // Preserve idempotency: never overwrite a record already PROMOTED into
  // production. Re-running ingest refreshes only un-promoted staging rows.
  const promotedRows = await delegateFor(prisma, result.entity).findMany({
    where: { sourceSystem, status: 'PROMOTED' },
    select: { sourceId: true },
  });
  const promotedSourceIds = new Set(promotedRows.map((r) => r.sourceId));

  for (const record of result.records) {
    if (promotedSourceIds.has(record.sourceId)) {
      continue;
    }
    const base = {
      batchId,
      sourceSystem,
      sourceId: record.sourceId,
      status: record.status,
      conflictReason: record.conflictReason ?? null,
      raw: record.raw as Prisma.InputJsonValue,
    };
    const d = record.data;

    switch (result.entity) {
      case 'customer':
        await prisma.stagingCustomer.upsert({
          where: { sourceSystem_sourceId: { sourceSystem, sourceId: record.sourceId } },
          create: {
            ...base,
            name: (d['name'] as string) ?? null,
            email: (d['email'] as string) ?? null,
            phone: (d['phone'] as string) ?? null,
            billingAddress: jsonOrNull(d['billingAddress']),
            shippingAddress: jsonOrNull(d['shippingAddress']),
            creditTerms: (d['creditTerms'] as string) ?? null,
          },
          update: {
            batchId,
            status: record.status,
            conflictReason: record.conflictReason ?? null,
            raw: record.raw as Prisma.InputJsonValue,
            name: (d['name'] as string) ?? null,
            email: (d['email'] as string) ?? null,
            phone: (d['phone'] as string) ?? null,
            billingAddress: jsonOrNull(d['billingAddress']),
            shippingAddress: jsonOrNull(d['shippingAddress']),
            creditTerms: (d['creditTerms'] as string) ?? null,
            promotedId: null,
          },
        });
        break;
      case 'vendor':
        await prisma.stagingVendor.upsert({
          where: { sourceSystem_sourceId: { sourceSystem, sourceId: record.sourceId } },
          create: {
            ...base,
            name: (d['name'] as string) ?? null,
            email: (d['email'] as string) ?? null,
            phone: (d['phone'] as string) ?? null,
            address: jsonOrNull(d['address']),
            paymentTerms: (d['paymentTerms'] as string) ?? null,
          },
          update: {
            batchId,
            status: record.status,
            conflictReason: record.conflictReason ?? null,
            raw: record.raw as Prisma.InputJsonValue,
            name: (d['name'] as string) ?? null,
            email: (d['email'] as string) ?? null,
            phone: (d['phone'] as string) ?? null,
            address: jsonOrNull(d['address']),
            paymentTerms: (d['paymentTerms'] as string) ?? null,
            promotedId: null,
          },
        });
        break;
      case 'product':
        await prisma.stagingProduct.upsert({
          where: { sourceSystem_sourceId: { sourceSystem, sourceId: record.sourceId } },
          create: {
            ...base,
            sku: (d['sku'] as string) ?? null,
            description: (d['description'] as string) ?? null,
            unitOfMeasure: (d['unitOfMeasure'] as string) ?? null,
            category: (d['category'] as string) ?? null,
            inventoryOnHand: (d['inventoryOnHand'] as number) ?? null,
          },
          update: {
            batchId,
            status: record.status,
            conflictReason: record.conflictReason ?? null,
            raw: record.raw as Prisma.InputJsonValue,
            sku: (d['sku'] as string) ?? null,
            description: (d['description'] as string) ?? null,
            unitOfMeasure: (d['unitOfMeasure'] as string) ?? null,
            category: (d['category'] as string) ?? null,
            inventoryOnHand: (d['inventoryOnHand'] as number) ?? null,
            promotedId: null,
          },
        });
        break;
      case 'quote':
        await prisma.stagingQuote.upsert({
          where: { sourceSystem_sourceId: { sourceSystem, sourceId: record.sourceId } },
          create: {
            ...base,
            customerSourceId: (d['customerSourceId'] as string) ?? null,
            quoteNumber: (d['quoteNumber'] as string) ?? null,
            status_legacy: (d['status_legacy'] as string) ?? null,
            totalAmount: (d['totalAmount'] as number) ?? null,
            currency: (d['currency'] as string) ?? null,
            quotedAt: (d['quotedAt'] as Date) ?? null,
            lineItems: jsonOrNull(d['lineItems']),
          },
          update: {
            batchId,
            status: record.status,
            conflictReason: record.conflictReason ?? null,
            raw: record.raw as Prisma.InputJsonValue,
            customerSourceId: (d['customerSourceId'] as string) ?? null,
            quoteNumber: (d['quoteNumber'] as string) ?? null,
            status_legacy: (d['status_legacy'] as string) ?? null,
            totalAmount: (d['totalAmount'] as number) ?? null,
            currency: (d['currency'] as string) ?? null,
            quotedAt: (d['quotedAt'] as Date) ?? null,
            lineItems: jsonOrNull(d['lineItems']),
            promotedId: null,
          },
        });
        break;
    }
  }

  return {
    entity: result.entity,
    loaded: result.records.length,
    valid: result.validCount,
    conflicts: result.conflictCount,
  };
}
