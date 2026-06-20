# CMMS Event Registry

| Topic | Payload |
|-------|---------|
| `cmms.workorder.created` | `{ mwoId, mwoNumber, assetId, type, triggerRuleId? }` |
| `cmms.workorder.completed` | `{ mwoId, mwoNumber, assetId, triggerRuleId?, completedByUserId }` |
| `cmms.pm.triggered` | `{ mwoId, mwoNumber, assetId, triggerRuleId, triggerType, cumulativeCycles? }` |

## Subscribers

| Consumer group | Topic | Handler |
|----------------|-------|---------|
| `cmms-pm` | `mes.cycle.recorded` | Increment asset cycles and evaluate CYCLE_COUNT PM rules |
