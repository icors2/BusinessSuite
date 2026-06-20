# Sales Orders — Fulfillment

## Purpose

Convert accepted quotes to sales orders, allocate WMS inventory, confirm shipments, and auto-post AR invoices.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Convert, allocate, ship, cancel |
| Viewer | Read orders |

## UI routes

| Route | Description |
|-------|-------------|
| `/sales/orders` | Order list with status filters |
| `/sales/orders/:id` | Detail — allocate, ship, cancel |

## Key tasks

1. Convert an **Accepted** quote to a sales order.
2. **Allocate** — reserves inventory from bins (may backorder if insufficient).
3. **Confirm shipment** — decrements WMS, creates shipment record, posts invoice.
4. Review order status: ALLOCATED, BACKORDERED, PARTIALLY_SHIPPED, SHIPPED.
5. Seeded order `SO-SEED-001` may have shipped lines for Returns testing.

## Permissions

- Mutations require **Admin** or **Manager**.

## tRPC procedures

- `salesOrder`: convert, get, list, allocate, confirmShipment, cancel

## Related events

`sales.order.created`, `sales.order.allocated`, `sales.order.backordered`, `sales.order.shipped`

## Demo login

`manager@arcncode.local` / `Manager123!`
