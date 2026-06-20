# Workforce — Scheduling & Time Clock

## Purpose

Employee roster, shift scheduling, assignments, kiosk time clock, and labor cost reporting by work order and department.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Schedule, assign, clock in/out (kiosk), reports |
| Operator+ | Clock in/out on kiosk |

## UI routes

| Route | Description |
|-------|-------------|
| `/workforce/schedule` | Shift grid and assignments |
| `/workforce/time-clock` | Tablet kiosk — tap roster or badge |
| `/workforce/labor-cost` | Labor cost roll-up |

## Key tasks

1. **Schedule** — create shifts and assign employees (seeded operators on LINE-A).
2. **Time clock** — operator taps name or enters badge to clock in/out.
3. Open time entries appear on MES operator console roster.
4. **Labor cost** — view hours and cost by work order/department.

## Permissions

- Schedule edits: **Admin** or **Manager** (`canEdit`).
- Clock in/out: **Admin**, **Manager**, or **Operator** (`canOperate`).

## tRPC procedures

- `workforce`: createEmployee, updateEmployee, upsertShift, assignShift, markUnavailable, clockIn, clockOut, listEmployees, listShifts, listAssignments, listOpenTimeEntries, getLaborCostReport

## Related events

`workforce.shift.assigned`, `workforce.time.clocked_in`, `workforce.time.clocked_out`

## Demo login

- Schedule: `manager@arcncode.local` / `Manager123!`
- Kiosk: `operator@arcncode.local` / `Operator123!`
