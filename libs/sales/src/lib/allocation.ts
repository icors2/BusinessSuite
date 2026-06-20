export interface BinAvailability {
  binId: string;
  binCode?: string;
  available: number;
}

export interface AllocationResult {
  allocations: Array<{ binId: string; binCode?: string; quantity: number }>;
  allocated: number;
  backordered: number;
}

/** Greedy allocation across bins sorted by available descending. */
export function greedyAllocate(
  qtyNeeded: number,
  bins: BinAvailability[],
): AllocationResult {
  if (qtyNeeded <= 0) {
    return { allocations: [], allocated: 0, backordered: 0 };
  }

  const sorted = [...bins]
    .filter((b) => b.available > 0)
    .sort((a, b) => b.available - a.available);

  let remaining = qtyNeeded;
  const allocations: AllocationResult['allocations'] = [];

  for (const bin of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, bin.available);
    if (take <= 0) continue;
    allocations.push({
      binId: bin.binId,
      binCode: bin.binCode,
      quantity: take,
    });
    remaining -= take;
  }

  const allocated = qtyNeeded - remaining;
  return {
    allocations,
    allocated,
    backordered: remaining,
  };
}

export function deriveOrderStatus(
  lines: Array<{
    qtyOrdered: number;
    qtyShipped: number;
    qtyBackordered: number;
    toProduce?: boolean;
  }>,
  current: string,
): 'ALLOCATED' | 'BACKORDERED' | 'PARTIALLY_SHIPPED' | 'SHIPPED' {
  const allShipped = lines.every((l) => l.qtyShipped >= l.qtyOrdered);
  if (allShipped && lines.length > 0) return 'SHIPPED';

  const anyShipped = lines.some((l) => l.qtyShipped > 0);
  if (anyShipped) return 'PARTIALLY_SHIPPED';

  const anyBackorder = lines.some((l) => l.qtyBackordered > 0);
  if (anyBackorder) return 'BACKORDERED';

  if (current === 'DRAFT') return 'ALLOCATED';
  return 'ALLOCATED';
}

export function maxShippableQty(line: {
  kind: string;
  qtyOrdered: number;
  qtyAllocated: number;
  qtyShipped: number;
  toProduce: boolean;
}): number {
  const remaining =
    line.kind === 'FABRICATED' || line.toProduce
      ? line.qtyOrdered - line.qtyShipped
      : line.qtyAllocated - line.qtyShipped;
  return Math.max(0, remaining);
}
