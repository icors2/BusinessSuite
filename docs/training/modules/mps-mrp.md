# MPS — Master Production Schedule

## Purpose

Aggregate demand, compute net requirements, and schedule work orders on production lines with capacity-aware calendar.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Generate schedule, reschedule, configure lines/calendar/strategy |
| Viewer | Dashboard and read-only views |

## UI routes

| Route | Description |
|-------|-------------|
| `/mps/dashboard` | Demand preview, work order timeline, overload warnings, reschedule |

## Key tasks

1. Open **MPS Dashboard** — review demand preview for seeded products.
2. **Generate schedule** — creates work orders on lines (e.g. `LINE-A`).
3. Review overload warnings when capacity exceeded.
4. **Reschedule** a work order to a new date/line.
5. Configure lines, calendar days, and scheduling strategy (Admin/Manager).

## Permissions

- Schedule mutations require **Admin** or **Manager**.

## tRPC procedures

- `mps`: previewDemand, generateSchedule, listWorkOrders, getWorkOrder, listLines, getCalendar, rescheduleWorkOrder, upsertLine, upsertCalendarDay, setStrategy, setProductStrategy, listSettings

## Related events

`mps.schedule.generated`, `mps.workorder.scheduled`, `mps.workorder.rescheduled`

## Demo login

`manager@arcncode.local` / `Manager123!`

---

# MRP — Material Requirements Planning

## Purpose

Multi-level BOM explosion, net material demand, and purchase requisition suggestions for procurement.

## UI routes

| Route | Description |
|-------|-------------|
| `/mrp/procurement` | Run MRP, requirements, requisition review |

## Key tasks

1. **Run MRP** — explodes BOMs and computes net requirements.
2. Review **exploded requirements** and suggested requisitions.
3. **Review requisition** — approve, reject, or adjust quantity.
4. **Upsert BOM** — maintain bill of materials for manufactured products.

## tRPC procedures

- `mrp`: runMrp, getRequirements, listRequisitions, getBom, reviewRequisition, upsertBom

## Related events

`mrp.run.completed`, `mrp.requisition.created`, `mrp.requisition.approved`
