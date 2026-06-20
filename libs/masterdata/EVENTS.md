# Master Data Events

Master data domain events published to the Redis Streams event bus (`anc:event-bus`).

## Product

| Topic | When |
|-------|------|
| `masterdata.product.created` | New product created |
| `masterdata.product.updated` | Product fields updated |
| `masterdata.product.deactivated` | Product soft-deleted (deactivated) |

## Customer

| Topic | When |
|-------|------|
| `masterdata.customer.created` | New customer created |
| `masterdata.customer.updated` | Customer fields updated |
| `masterdata.customer.deactivated` | Customer soft-deleted (deactivated) |

## Vendor

| Topic | When |
|-------|------|
| `masterdata.vendor.created` | New vendor created |
| `masterdata.vendor.updated` | Vendor fields updated |
| `masterdata.vendor.deactivated` | Vendor soft-deleted (deactivated) |

## Payload Shape

All events use the standard `EventEnvelope`:

```json
{
  "topic": "masterdata.product.created",
  "entityId": "<uuid>",
  "actorId": "<user-uuid>",
  "timestamp": "2026-06-20T00:00:00.000Z",
  "version": 1,
  "payload": { }
}
```

Entity-specific fields are included in `payload` (e.g. `sku` for products, `name` for customers/vendors).

## Verification

`MasterdataLogSubscriber` subscribes to all topics above and logs events at startup. Check API logs for lines prefixed with `[masterdata-event]`.
