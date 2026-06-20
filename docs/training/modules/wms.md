# WMS — Inventory Management

## Purpose

Locations, bins, inventory quantities, and movements: receive, move, pick, ship, adjust, allocate. `available = onHand - allocated`.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | All movements and master data |
| Viewer | Read inventory levels |

## UI routes

| Route | Description |
|-------|-------------|
| `/wms/receive` | Receive stock into a bin |
| `/wms/move` | Transfer between bins |
| `/wms/pick` | Pick for fulfillment |
| `/wms/inventory` | On-hand and allocation lookup |

## Key tasks

1. **Receive** — add stock to bin `A-01-01` for `SKU-001`.
2. **Move** — transfer quantity between bins.
3. **Pick** — decrement source bin (respects available unless override).
4. **Inventory** — view by product, bin, or location.
5. Seeded location `RETURNS` / bin `RET-01` holds return stock (Phase 15).

## Permissions

- Writes require **Admin** or **Manager**.
- Pick/ship blocked when bin or work order is on QMS hold.

## tRPC procedures

- `inventory`: createLocation, listLocations, createBin, listBins, receive, move, pick, ship, adjust, allocate, deallocate, byProduct, byBin, byLocation

## Related events

`wms.inventory.received`, `wms.inventory.moved`, `wms.inventory.shipped`, `wms.inventory.adjusted`

## Demo login

`manager@arcncode.local` / `Manager123!`
