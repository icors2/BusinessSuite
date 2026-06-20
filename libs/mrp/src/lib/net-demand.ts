import { AggregatedRequirement } from './explosion';

export interface NetRequirement extends AggregatedRequirement {
  onHand: number;
  existingPending: number;
  openPurchaseOrders: number;
  inventoryApplied: number;
  netQty: number;
}

/**
 * Net demand = gross − on-hand inventory − existing pending requisitions − open POs.
 * Inventory is applied to earliest need-by buckets per product first.
 */
export function calculateNetDemand(
  requirements: AggregatedRequirement[],
  inventoryByProduct: Map<string, number>,
  pendingByKey: Map<string, number>,
  openPoByProduct: Map<string, number>,
): NetRequirement[] {
  const byProduct = new Map<string, AggregatedRequirement[]>();
  for (const req of requirements) {
    const list = byProduct.get(req.productId) ?? [];
    list.push(req);
    byProduct.set(req.productId, list);
  }

  const remainingInventory = new Map(inventoryByProduct);
  const result: NetRequirement[] = [];

  for (const [, productReqs] of byProduct) {
    const sorted = [...productReqs].sort(
      (a, b) => a.needByDate.getTime() - b.needByDate.getTime(),
    );

    for (const req of sorted) {
      const invRemaining = remainingInventory.get(req.productId) ?? 0;
      const inventoryApplied = Math.min(invRemaining, req.grossQty);
      remainingInventory.set(
        req.productId,
        Math.max(0, invRemaining - inventoryApplied),
      );

      const key = `${req.productId}:${req.needByDate.toISOString().slice(0, 10)}`;
      const existingPending = pendingByKey.get(key) ?? 0;
      const openPo = openPoByProduct.get(req.productId) ?? 0;

      const afterInventory = req.grossQty - inventoryApplied;
      const netQty = Math.max(
        0,
        afterInventory - existingPending - openPo,
      );

      result.push({
        ...req,
        onHand: inventoryByProduct.get(req.productId) ?? 0,
        existingPending,
        openPurchaseOrders: openPo,
        inventoryApplied,
        netQty,
      });
    }
  }

  return result.sort(
    (a, b) => a.needByDate.getTime() - b.needByDate.getTime(),
  );
}
