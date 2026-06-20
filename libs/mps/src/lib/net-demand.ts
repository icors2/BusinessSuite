import { DemandBucket } from './aggregation';

export interface NetDemandBucket extends DemandBucket {
  grossQty: number;
  availableInventory: number;
  inventoryApplied: number;
  alreadyScheduled: number;
  netQty: number;
}

/**
 * Net demand = gross aggregated demand − available inventory (earliest period
 * per product) − already-scheduled production for the same product/period.
 */
export function calculateNetDemand(
  buckets: DemandBucket[],
  inventoryByProduct: Map<string, number>,
  scheduledByProductPeriod: Map<string, number>,
): NetDemandBucket[] {
  const byProduct = new Map<string, DemandBucket[]>();
  for (const bucket of buckets) {
    const list = byProduct.get(bucket.productId) ?? [];
    list.push(bucket);
    byProduct.set(bucket.productId, list);
  }

  const remainingInventory = new Map(inventoryByProduct);
  const result: NetDemandBucket[] = [];

  for (const [, productBuckets] of byProduct) {
    const sorted = [...productBuckets].sort(
      (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
    );

    for (const bucket of sorted) {
      const invRemaining = remainingInventory.get(bucket.productId) ?? 0;
      const inventoryApplied = Math.min(invRemaining, bucket.qty);
      remainingInventory.set(
        bucket.productId,
        Math.max(0, invRemaining - inventoryApplied),
      );

      const schedKey = `${bucket.productId}:${bucket.periodKey}`;
      const alreadyScheduled = scheduledByProductPeriod.get(schedKey) ?? 0;
      const afterInventory = bucket.qty - inventoryApplied;
      const netQty = Math.max(0, afterInventory - alreadyScheduled);

      result.push({
        ...bucket,
        grossQty: bucket.qty,
        availableInventory: inventoryByProduct.get(bucket.productId) ?? 0,
        inventoryApplied,
        alreadyScheduled,
        netQty,
      });
    }
  }

  return result.sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );
}
