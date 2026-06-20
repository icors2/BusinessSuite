# QMS Events

| Topic | When | Payload |
|-------|------|---------|
| `qms.inspection.completed` | Inspector completes a checklist | `{ inspectionId, templateId, workOrderId?, operationId?, result }` |
| `qms.nonconformance.raised` | NC created from failed inspection or manual raise | `{ nonConformanceId, ncNumber, source, severity, holdActive, workOrderId?, binId? }` |
| `qms.nonconformance.resolved` | Supervisor dispositions and resolves NC | `{ nonConformanceId, ncNumber, disposition, workOrderId?, binId? }` |
| `qms.scrap.reported` | Standalone scrap report | `{ nonConformanceId, ncNumber, workOrderId?, binId?, productId?, quantityScrapped }` |

Consumers: Phase 14 (CMMS scrap triggers), Phase 15 (RMA non-conformance linkage).
