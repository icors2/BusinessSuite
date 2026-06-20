# Returns Event Registry

| Topic | Payload |
|-------|---------|
| `returns.rma.requested` | `{ rmaId, rmaNumber, salesOrderId, customerId, salesOrderLineId, quantity }` |
| `returns.rma.received` | `{ rmaId, rmaNumber, salesOrderId, returnedBinId, nonConformanceId?, qualityRelated }` |
| `returns.rma.resolved` | `{ rmaId, rmaNumber, resolutionType, creditMemoId? }` |

## Finance integration

Refund resolutions emit `finance.creditmemo.created` and `finance.creditmemo.posted` via `CreditMemoService`.

## QMS integration

Quality-related returns call `QmsService.raiseReturnNonConformance` with source `RETURN` on receive.
