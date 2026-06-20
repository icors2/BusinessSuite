# Returns & RMA

## Purpose

Return merchandise authorization against shipped sales order lines: request, approve/reject, receive into returns bin, resolve with refund credit memo.

## Who uses it

| Role | Access |
|------|--------|
| Support | Full RMA lifecycle (request through resolve) |
| Supervisor, Manager, Admin | Same as Support |
| All authenticated | Read RMA list/detail |

## UI routes

| Route | Description |
|-------|-------------|
| `/returns/queue` | RMA queue with status filters |
| `/returns/:id` | RMA detail and lifecycle actions |

## Key tasks

1. **Request RMA** — select shipped line on `SO-SEED-001`, specify quantity and reason.
2. **Approve** or **Reject** the request.
3. **Receive** — move returned qty into bin `RET-01` (location `RETURNS`).
4. **Resolve** — choose REFUND; system posts credit memo (DR Revenue 4000, CR AR 1100).
5. Quality returns may link a QMS non-conformance.

## Permissions

- Lifecycle mutations: **Support**+ (`canSupport` — Support, Supervisor, Manager, Admin).

## tRPC procedures

- `returns`: requestRma, approveRma, rejectRma, receiveRma, resolveRma, listRmas, getRma

## Related events

`returns.rma.requested`, `returns.rma.approved`, `returns.rma.received`, `returns.rma.resolved`

## Demo login

`support@arcncode.local` / `Support123!`
