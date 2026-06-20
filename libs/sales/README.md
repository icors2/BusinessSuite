# Sales (Phase 7)

Sales order conversion, WMS allocation, fulfillment, and Finance invoicing on ship.

## Prisma models

- `SalesOrder` — header linked to originating `Quote` (optional, unique)
- `SalesOrderLine` — PRODUCT (WMS allocation) or FABRICATED (make-to-order)
- `SalesOrderShipment` — shipment record with linked `invoiceId`

## Services

- `SalesOrderService` — convert, allocate, confirmShipment, cancel, list, get
- `QuoteAcceptedSubscriber` — listens for `sales.quote.accepted`, auto-converts

## tRPC (`salesOrder` router)

| Procedure | Access | Description |
|-----------|--------|-------------|
| `convert` | Editor | Convert accepted quote to order (idempotent) |
| `get` | Protected | Order detail |
| `list` | Protected | List with status/backorder filters |
| `allocate` | Editor | Re-run WMS allocation |
| `confirmShipment` | Editor | Ship lines + create/post invoice |
| `cancel` | Editor | Cancel + deallocate |

## Events emitted

See [EVENTS.md](./EVENTS.md).

## Dependencies

- `wms` — `InventoryService` for allocate/deallocate/ship
- `finance` — `InvoiceService` for invoice on ship
- `cpq` — listens to `sales.quote.accepted`
