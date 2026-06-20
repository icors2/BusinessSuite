/** Stable demo entity identifiers — keep in sync with docs/demo/demo-data-catalog.md */
export const DEMO = {
  SKU_MAKE: 'SKU-DEMO-001',
  SKU_BUY: 'SKU-DEMO-002',
  SKU_FINISHED: 'SKU-DEMO-003',
  CUSTOMER_GLOBEX: 'Globex Corporation',
  VENDOR_PARTS: 'Precision Parts Ltd',
  Q_DRAFT: 'Q-DEMO-001',
  Q_SENT: 'Q-DEMO-002',
  Q_ACCEPTED: 'Q-DEMO-003',
  SO_SHIPPED: 'SO-DEMO-001',
  SO_ALLOCATED: 'SO-DEMO-002',
  WO_DEMO: 'WO-DEMO-001',
  PO_PARTIAL: 'PO-DEMO-001',
  PO_ASN: 'PO-DEMO-002',
  MWO: 'MWO-DEMO-001',
  RMA_REQUESTED: 'RMA-DEMO-001',
  RMA_APPROVED: 'RMA-DEMO-002',
  RMA_RECEIVED: 'RMA-DEMO-003',
  RMA_RESOLVED: 'RMA-DEMO-004',
  INV_SHIPPED: 'INV-DEMO-001',
  BILL_DEMO: 'BILL-DEMO-001',
  CM_DEMO: 'CM-DEMO-001',
  PR_PENDING: 'PR-DEMO-PENDING',
  PR_APPROVED: 'PR-DEMO-APPROVED',
  TMPL_DEMO: 'TMPL-DEMO-001',
  ASSET_DEMO: 'ASSET-DEMO-001',
  BIN_DEMO: 'B-DEMO-01',
} as const;

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function utcMidnight(d: Date = new Date()): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
