# Shared Audit Library

Persists who-did-what-when audit records to PostgreSQL.

## Usage

```typescript
await auditService.record({
  actorId: userId,
  action: 'entity.updated',
  entityType: 'Product',
  entityId: productId,
  metadata: { field: 'name' },
});
```
