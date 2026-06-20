# Workforce Events

| Topic | Emitted when |
|-------|----------------|
| `workforce.shift.assigned` | An employee is assigned to a shift on a calendar date |
| `workforce.clock.in` | An employee clocks in (kiosk or badge) |
| `workforce.clock.out` | An employee clocks out; entry is closed or flagged |

Payloads include `employeeId`, actor context where applicable, and entity IDs for downstream subscribers.
