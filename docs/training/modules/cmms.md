# CMMS — Maintenance Management

## Purpose

Assets linked to MES workstations, preventive maintenance rules (cycle-count and calendar), maintenance work orders, due-soon/overdue tracking.

## Who uses it

| Role | Access |
|------|--------|
| Technician | Start/complete maintenance work orders |
| Admin, Manager | Assets, PM rules, create/cancel MWOs, calendar triggers |

## UI routes

| Route | Description |
|-------|-------------|
| `/cmms/assets` | Asset list, PM rules, calendar evaluation |
| `/cmms/work-orders` | MWO queue — start/complete |

## Key tasks

1. **Assets** — review seeded asset on `WS-LASER`; configure PM rule (cycle or calendar).
2. Cycle PM auto-triggers from `mes.cycle.recorded` via `CmmsCycleSubscriber`.
3. **Evaluate calendar triggers** — manual/cron for date-based PM.
4. **Work orders** — technician starts and completes MWO with labor/parts notes.

## Permissions

- Start/complete MWO: **Technician**+ (`canMaintain`).
- Asset/PM config: **Admin** or **Manager**.

## tRPC procedures

- `cmms`: upsertAsset, upsertPmRule, createMaintenanceWorkOrder, cancelMaintenanceWorkOrder, evaluateCalendarTriggers, startMaintenanceWorkOrder, completeMaintenanceWorkOrder, listAssets, getAsset, listPmRules, listMaintenanceWorkOrders, getMaintenanceWorkOrder, getDueSoon, getMaintenanceHistoryForWorkOrder

## Related events

`cmms.mwo.created`, `cmms.mwo.started`, `cmms.mwo.completed`, `cmms.pm.triggered`

## Demo login

- Technician: `technician@arcncode.local` / `Technician123!`
- Config: `manager@arcncode.local` / `Manager123!`
