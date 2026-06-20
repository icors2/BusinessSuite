# CPQ Events

| Topic | When emitted | Payload highlights |
| --- | --- | --- |
| `sales.quote.created` | New quote header saved | `quoteId`, `quoteNumber`, `customerId`, `status` |
| `sales.quote.sent` | Quote transitions DRAFT → SENT (pricing frozen) | `quoteId`, `quoteNumber`, `customerId`, `status` |
| `sales.quote.accepted` | Customer accepts sent quote (Phase 7 listens) | `quoteId`, `quoteNumber`, `customerId`, `total`, `currency`, `lines[]` |
| `sales.quote.rejected` | Quote rejected while SENT | `quoteId`, `quoteNumber`, `customerId`, `status` |
| `sales.quote.expired` | Quote marked expired (manual or accept on past `validUntil`) | `quoteId`, `quoteNumber`, reason |

Phase 7 (Sales Orders) should subscribe to `sales.quote.accepted` and use the line payload to create an order.
