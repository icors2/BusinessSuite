import { ProcurementType } from '@prisma/client';

export interface WorkOrderInput {
  id: string;
  productId: string;
  quantity: number;
  scheduledStart: Date;
}

export interface BomLineInput {
  componentProductId: string;
  quantityPer: number;
  scrapFactor: number;
}

export interface ProductInput {
  id: string;
  sku: string;
  procurementType: ProcurementType;
  leadTimeDays: number;
  preferredVendorId: string | null;
  vendorLeadTimeDays: number;
}

export interface ExplodedLine {
  productId: string;
  productSku: string;
  quantity: number;
  workOrderId: string;
  scheduledStart: Date;
  level: number;
  procurementType: ProcurementType;
  leadTimeDays: number;
  preferredVendorId: string | null;
}

function effectiveLeadTime(product: ProductInput): number {
  return product.leadTimeDays > 0
    ? product.leadTimeDays
    : product.vendorLeadTimeDays;
}

export function explodeBom(
  workOrders: WorkOrderInput[],
  bomMap: Map<string, BomLineInput[]>,
  productMap: Map<string, ProductInput>,
): ExplodedLine[] {
  const results: ExplodedLine[] = [];

  for (const wo of workOrders) {
    explodeProduct(
      wo.productId,
      wo.quantity,
      wo.id,
      wo.scheduledStart,
      0,
      new Set<string>(),
      bomMap,
      productMap,
      results,
    );
  }

  return results;
}

function explodeProduct(
  productId: string,
  quantity: number,
  workOrderId: string,
  scheduledStart: Date,
  level: number,
  path: Set<string>,
  bomMap: Map<string, BomLineInput[]>,
  productMap: Map<string, ProductInput>,
  results: ExplodedLine[],
): void {
  if (path.has(productId)) {
    return;
  }

  const product = productMap.get(productId);
  if (!product) {
    return;
  }

  const lines = bomMap.get(productId);
  const isMake = product.procurementType === ProcurementType.MAKE;

  if (isMake && lines && lines.length > 0) {
    const nextPath = new Set(path);
    nextPath.add(productId);
    for (const line of lines) {
      const componentQty =
        quantity * line.quantityPer * (1 + line.scrapFactor);
      explodeProduct(
        line.componentProductId,
        componentQty,
        workOrderId,
        scheduledStart,
        level + 1,
        nextPath,
        bomMap,
        productMap,
        results,
      );
    }
    return;
  }

  results.push({
    productId: product.id,
    productSku: product.sku,
    quantity,
    workOrderId,
    scheduledStart,
    level,
    procurementType: product.procurementType,
    leadTimeDays: effectiveLeadTime(product),
    preferredVendorId: product.preferredVendorId,
  });
}

export interface AggregatedRequirement {
  productId: string;
  productSku: string;
  needByDate: Date;
  grossQty: number;
  workOrderIds: string[];
  leadTimeDays: number;
  preferredVendorId: string | null;
}

export function aggregateRequirements(
  exploded: ExplodedLine[],
  needByFn: (scheduledStart: Date, leadTimeDays: number) => Date,
): AggregatedRequirement[] {
  const map = new Map<string, AggregatedRequirement>();

  for (const line of exploded) {
    if (line.procurementType !== ProcurementType.BUY) {
      continue;
    }

    const needByDate = needByFn(line.scheduledStart, line.leadTimeDays);
    const dateKey = needByDate.toISOString().slice(0, 10);
    const key = `${line.productId}:${dateKey}`;

    const existing = map.get(key);
    if (existing) {
      existing.grossQty += line.quantity;
      if (!existing.workOrderIds.includes(line.workOrderId)) {
        existing.workOrderIds.push(line.workOrderId);
      }
    } else {
      map.set(key, {
        productId: line.productId,
        productSku: line.productSku,
        needByDate,
        grossQty: line.quantity,
        workOrderIds: [line.workOrderId],
        leadTimeDays: line.leadTimeDays,
        preferredVendorId: line.preferredVendorId,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => a.needByDate.getTime() - b.needByDate.getTime(),
  );
}
