# MPS — Master Production Schedule

Phase 8 module. Aggregates open sales demand into work orders using Weekly, Monthly, or Build-To-Order strategies per product/category.

## Services

- **MpsService** — demand preview, schedule generation, work order CRUD/reschedule, factory calendar and production line management.

## Pure helpers

- `aggregation.ts` — demand bucketing by strategy
- `net-demand.ts` — net demand = gross − inventory − scheduled
- `scheduling.ts` — capacity-aware work order proposal with overload detection

## Events

See [EVENTS.md](./EVENTS.md).

## Dependencies

- `wms` — inventory availability for net demand
- `sales` — open sales order lines as demand source (via Prisma + optional subscriber)
