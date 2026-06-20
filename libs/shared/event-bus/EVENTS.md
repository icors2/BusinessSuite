# Arc N Code Business Suite — Event Bus

## Transport choice: Redis Streams

Phase 0 uses **Redis Streams** (not pub/sub) for the Event Bus because:

- Events are **durable** and can be replayed (required by Phase 16 Analytics)
- **Consumer groups** support multiple subscribers per topic pattern
- Messages are **acknowledged** after processing (`XACK`)

## Stream key

All events are written to a single stream: `anc:event-bus`

Each message includes a `topic` field following the convention `domain.entity.action`.

## Envelope schema (version 1)

Every event payload includes:

| Field | Type | Description |
|-------|------|-------------|
| `topic` | string | e.g. `auth.user.registered` |
| `entityId` | string | Primary entity UUID |
| `orgId` | string? | Tenant/org identifier (future) |
| `actorId` | string? | User who triggered the event |
| `timestamp` | ISO8601 string | Event time |
| `version` | number | Payload schema version |
| `payload` | object | Domain-specific data |

## Phase 0 topics

| Topic | Emitted by | When |
|-------|-----------|------|
| _None emitted yet via Event Bus in Phase 0_ | — | Auth uses audit log; modules from Phase 1+ will publish here |

## Usage

```typescript
import { EVENT_BUS, EventBus } from 'event-bus';

await eventBus.publish('masterdata.product.created', {
  entityId: product.id,
  actorId: userId,
  payload: { sku: product.sku },
});
```
