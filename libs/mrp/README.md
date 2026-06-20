# MRP — Material Requirements Planning

Phase 9 module. Multi-level BOM explosion from open work orders drives component net demand and purchase requisition generation.

## Services

- **MrpService** — MRP run, requirements preview, requisition review, BOM management.

## Pure helpers

- `explosion.ts` — recursive multi-level BOM explosion with scrap factor
- `net-demand.ts` — net demand = gross − inventory − pending requisitions − open POs
- `requisitions.ts` — need-by date back-calculation from lead time

## Events

See [EVENTS.md](./EVENTS.md).

## Dependencies

- `wms` — on-hand inventory for net demand
- Phase 10 will supply open PO netting
