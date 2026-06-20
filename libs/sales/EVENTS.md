# Sales Events

| Topic | When emitted | Payload highlights |
| --- | --- | --- |
| `sales.order.created` | Sales order created from accepted quote | `orderId`, `orderNumber`, `quoteId`, `customerId`, `total` |
| `sales.order.allocated` | Inventory allocated for PRODUCT lines | `orderId`, `orderNumber`, `lines[]` with qtyAllocated |
| `sales.order.backordered` | Shortfall after allocation attempt | `orderId`, `orderNumber`, `lines[]` with qtyBackordered |
| `sales.order.shipped` | Shipment confirmed (partial or full) | `orderId`, `orderNumber`, `shipmentId`, `invoiceId`, `shippedLines[]` |

Phase 7 listens to `sales.quote.accepted` (from CPQ) via `QuoteAcceptedSubscriber` to auto-convert quotes to orders.

Finance invoicing is triggered synchronously on ship via `InvoiceService` — downstream modules may also listen to `finance.invoice.posted`.
