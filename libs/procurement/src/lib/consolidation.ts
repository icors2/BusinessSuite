export interface RequisitionForConsolidation {
  id: string;
  componentProductId: string;
  componentSku: string;
  componentDescription: string;
  quantity: number;
  needByDate: Date;
  preferredVendorId: string | null;
  listPrice: number | null;
}

export interface ConsolidatedPoDraft {
  vendorId: string;
  expectedDeliveryDate: Date | null;
  demandRefs: string[];
  lines: Array<{
    requisitionId: string;
    productId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    expectedDeliveryDate: Date | null;
  }>;
}

export interface ConsolidationResult {
  drafts: ConsolidatedPoDraft[];
  skipped: Array<{ requisitionId: string; reason: string }>;
}

export function consolidateRequisitions(
  requisitions: RequisitionForConsolidation[],
): ConsolidationResult {
  const skipped: ConsolidationResult['skipped'] = [];
  const byVendor = new Map<string, RequisitionForConsolidation[]>();

  for (const req of requisitions) {
    if (!req.preferredVendorId) {
      skipped.push({
        requisitionId: req.id,
        reason: 'Missing preferred vendor',
      });
      continue;
    }
    const list = byVendor.get(req.preferredVendorId) ?? [];
    list.push(req);
    byVendor.set(req.preferredVendorId, list);
  }

  const drafts: ConsolidatedPoDraft[] = [];

  for (const [vendorId, reqs] of byVendor) {
    const lines = reqs.map((req) => {
      const unitPrice = req.listPrice ?? 0;
      const quantity = req.quantity;
      return {
        requisitionId: req.id,
        productId: req.componentProductId,
        description: req.componentDescription || req.componentSku,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        expectedDeliveryDate: req.needByDate,
      };
    });

    const expectedDeliveryDate = lines.reduce<Date | null>((earliest, line) => {
      if (!line.expectedDeliveryDate) return earliest;
      if (!earliest || line.expectedDeliveryDate < earliest) {
        return line.expectedDeliveryDate;
      }
      return earliest;
    }, null);

    drafts.push({
      vendorId,
      expectedDeliveryDate,
      demandRefs: reqs.map((r) => r.id),
      lines,
    });
  }

  return { drafts, skipped };
}
