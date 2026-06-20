# Demo Data Catalog

Stable entity identifiers for Phase 18 tutorials and UAT on the demo stack. Do not rename without updating tours and `seed-helpers.ts`.

## Products

| SKU | Type | Description |
|-----|------|-------------|
| `SKU-DEMO-001` | MAKE | Demo Assembly (BOM uses SKU-DEMO-002) |
| `SKU-DEMO-002` | BUY | Demo Raw Material |
| `SKU-DEMO-003` | MAKE | Demo Finished Good |

Legacy seed SKUs (`SKU-001`, `SKU-002`) remain for integration tests.

## Parties

| Entity | Name |
|--------|------|
| Customer | Globex Corporation |
| Vendor | Precision Parts Ltd |
| Customer (legacy) | Acme Manufacturing |

## CPQ Quotes

| Number | Status |
|--------|--------|
| `Q-DEMO-001` | DRAFT |
| `Q-DEMO-002` | SENT |
| `Q-DEMO-003` | ACCEPTED |

## Sales

| Order | Status | Notes |
|-------|--------|-------|
| `SO-DEMO-001` | SHIPPED | Invoice `INV-DEMO-001`; returns source |
| `SO-DEMO-002` | ALLOCATED | Linked to `Q-DEMO-003`; MTO fabricated line |

## Production

| Entity | ID |
|--------|-----|
| Work order | `WO-DEMO-001` |
| Workstation | `WS-LASER` |
| Demo bin | `B-DEMO-01` |

## Procurement

| Entity | Status |
|--------|--------|
| `PR-DEMO-PENDING` | PENDING requisition |
| `PR-DEMO-APPROVED` | APPROVED (converted to PO) |
| `PO-DEMO-001` | ISSUED, partial receipt (40/100) |
| `PO-DEMO-002` | ACKNOWLEDGED, ASN pending |

## Finance

| Entity | Status |
|--------|--------|
| `INV-DEMO-001` | POSTED (shipped SO) |
| `BILL-DEMO-001` | POSTED |
| `CM-DEMO-001` | POSTED (resolved RMA) |

## Quality & Maintenance

| Entity | Notes |
|--------|-------|
| `TMPL-DEMO-001` | Inspection template |
| `NC-DEMO-001` | HOLD — blocks WO + bin |
| `ASSET-DEMO-001` | Linked to WS-LASER |
| `MWO-DEMO-001` | Open corrective MWO |

## Returns (RMA)

| Number | Status |
|--------|--------|
| `RMA-DEMO-001` | REQUESTED |
| `RMA-DEMO-002` | APPROVED |
| `RMA-DEMO-003` | RECEIVED → `RET-01` |
| `RMA-DEMO-004` | RESOLVED (REFUND) |

## Workforce

| Entity | Notes |
|--------|-------|
| `EMP-DEMO-01` | Demo Operator — **clocked in** for MES tutorial |

## Cross-module chain

```
Q-DEMO-003 (ACCEPTED) → SO-DEMO-002 (ALLOCATED) → WO-DEMO-001 (IN_PROGRESS)
SO-DEMO-001 (SHIPPED) → INV-DEMO-001 → RMA-DEMO-* → CM-DEMO-001
PR-DEMO-APPROVED → PO-DEMO-001 → BILL-DEMO-001
```

## Demo logins

`<role>@arcncode.local` / `<Role>123!` — see [README.md](./README.md).
