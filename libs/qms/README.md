# QMS — Quality Management (Phase 13)

Inspection checklist templates, inspector-completed records with photo-per-criterion evidence, non-conformance tracking with hold flags on Work Orders and Bins.

## Prisma models

- `InspectionTemplate`, `InspectionCriterion`
- `InspectionRecord`, `InspectionCriterionResult`
- `NonConformanceRecord`
- `WorkOrder.onHold`, `Bin.onHold` (denormalized hold flags)

## tRPC router (`qms`)

| Procedure | RBAC | Description |
|-----------|------|-------------|
| `upsertTemplate` | Editor | Create/update checklist template |
| `addCriterion` | Editor | Add criterion to template |
| `completeInspection` | Inspector | Complete checklist; auto-raises NC on FAIL |
| `raiseNonConformance` | Inspector | Manual NC |
| `reportScrap` | Inspector | Standalone scrap report |
| `disposition` | Supervisor | Resolve NC and clear holds |
| `listTemplates`, `getTemplate` | Authenticated | Template reads |
| `listInspections`, `getInspection` | Authenticated | Inspection reads |
| `listNonConformances`, `getNonConformance` | Authenticated | NC reads |

## REST

- `POST /api/qms/inspections/:inspectionId/photo` — upload criterion photo (MinIO)
- `GET /api/qms/inspections/photo?key=...` — download photo

## Events

See [EVENTS.md](./EVENTS.md).

## Hold behavior

`HOLD` severity sets `holdActive` on the NC and `onHold` on linked Work Order and/or Bin. MES blocks `startOperation`/`verifyWorkOrder`; WMS blocks `pick`/`ship` until disposition resolves all open holds.
