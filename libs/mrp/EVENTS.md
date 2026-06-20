# MRP Events

| Topic | When | Payload |
|-------|------|---------|
| `mrp.run.completed` | MRP run finishes | `workOrdersProcessed`, `requisitionsCreated`, `requisitionsUpdated` |
| `mrp.requisition.created` | New purchase requisition generated | `requisitionId`, `reqNumber`, `componentProductId`, `quantity`, `needByDate` |
