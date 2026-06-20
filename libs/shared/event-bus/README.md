# Shared Event Bus Library

Redis Streams-based event bus for cross-module communication.

See [EVENTS.md](./EVENTS.md) for transport choice and topic conventions.

## API

```typescript
await eventBus.publish('domain.entity.action', {
  entityId, actorId, payload: { ... }
});

await eventBus.subscribe('domain.entity.action', async (event) => { ... });
```
