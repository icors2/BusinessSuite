# MES — Manufacturing Execution

## Purpose

Shop floor execution: workstations, sequential operations per work order, cycle records, supervisor verification, live dashboard, placards.

## Who uses it

| Role | Access |
|------|--------|
| Operator | Start/stop operations (must be clocked in) |
| Supervisor | Verify completed work orders, floor dashboard |
| Admin, Manager | Configure workstations/operations, generate ops |

## UI routes

| Route | Description |
|-------|-------------|
| `/mes/operator-console` | Start/stop operations, qty entry |
| `/mes/supervisor` | Live dashboard + verification |
| `/mes/scheduling` | Operations-by-workstation board |
| `/mes/placard` | Printable traveler with barcode |

## Key tasks

1. **Operator console** — clock in first (Workforce), select operation on `WS-LASER`, start/stop with quantity.
2. **Supervisor** — monitor live cycles (Socket.IO `/mes`), verify completed work order with optional photo.
3. **Scheduling board** — view operations by workstation.
4. **Placard** — print work-order traveler for shop floor.

## Permissions

- Start/stop: **Operator**+ (`canOperate`), requires clocked-in roster entry.
- Verify: **Supervisor**+ (`canVerify`).
- Config: **Admin** or **Manager**.

## tRPC procedures

- `mes`: upsertWorkstation, upsertOperation, generateOperations, startOperation, stopOperation, verifyWorkOrder, listWorkstations, listOperations, listOpenCycles, getDashboard, getPlacard

## Related events

`mes.cycle.started`, `mes.cycle.stopped`, `mes.cycle.recorded`, `mes.workorder.verified`

## Demo login

- Operator: `operator@arcncode.local` / `Operator123!`
- Supervisor: `supervisor@arcncode.local` / `Supervisor123!`
