# MES Events

| Topic | Emitted when |
|-------|----------------|
| `mes.operation.started` | An operator starts a work-order operation (cycle opened) |
| `mes.operation.completed` | An operation cycle is stopped and the operation marked complete |
| `mes.cycle.recorded` | A cycle record is closed with duration and quantity |
| `mes.workorder.verified` | A supervisor signs off a work order with optional photo evidence |

Payloads include entity IDs, operator attribution, and quantities for downstream subscribers (Phase 14 CMMS, dashboards).
