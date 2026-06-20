export interface ScorecardLineInput {
  lineId: string;
  productId: string;
  orderedQty: number;
  qtyReceived: number;
  expectedDeliveryDate: Date | null;
  receipts: Array<{ quantity: number; receivedAt: Date }>;
}

export interface ScorecardDateRange {
  from?: Date;
  to?: Date;
}

export interface VendorScorecardMetrics {
  totalReceipts: number;
  onTimeReceipts: number;
  onTimeRate: number;
  receivedLines: number;
  quantityAccurateLines: number;
  quantityAccuracyRate: number;
}

function inRange(date: Date, range: ScorecardDateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function computeScorecard(
  lines: ScorecardLineInput[],
  range: ScorecardDateRange = {},
): VendorScorecardMetrics {
  let totalReceipts = 0;
  let onTimeReceipts = 0;
  let receivedLines = 0;
  let quantityAccurateLines = 0;

  for (const line of lines) {
    const filteredReceipts = line.receipts.filter((r) =>
      inRange(r.receivedAt, range),
    );
    if (filteredReceipts.length === 0) {
      continue;
    }

    receivedLines += 1;
    if (Math.abs(line.qtyReceived - line.orderedQty) < 0.0001) {
      quantityAccurateLines += 1;
    }

    for (const receipt of filteredReceipts) {
      totalReceipts += 1;
      if (line.expectedDeliveryDate) {
        const expected = toDateOnly(line.expectedDeliveryDate);
        const received = toDateOnly(receipt.receivedAt);
        if (received <= expected) {
          onTimeReceipts += 1;
        }
      } else {
        onTimeReceipts += 1;
      }
    }
  }

  return {
    totalReceipts,
    onTimeReceipts,
    onTimeRate: totalReceipts > 0 ? onTimeReceipts / totalReceipts : 0,
    receivedLines,
    quantityAccurateLines,
    quantityAccuracyRate:
      receivedLines > 0 ? quantityAccurateLines / receivedLines : 0,
  };
}
