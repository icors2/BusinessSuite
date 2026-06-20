# MPS Events

| Topic | When | Payload |
|-------|------|---------|
| `mps.workorder.scheduled` | Work order created by schedule generation | `workOrderId`, `woNumber`, `productId`, `quantity`, `periodKey`, `lineId` |
| `mps.workorder.rescheduled` | Work order manually rescheduled | `workOrderId`, `woNumber`, `previousStart`, `previousEnd`, `scheduledStart`, `scheduledEnd`, `lineId` |
| `mps.capacity.overloaded` | Period/line demand exceeds capacity | `periodKey`, `lineId`, `lineCode`, `capacity`, `scheduled`, `utilization` |
