# CMMS Library

Computerized Maintenance Management System — assets, preventive maintenance trigger rules, and maintenance work orders.

## Features

- Asset registry linked to MES workstations
- PM trigger rules: cycle-count and calendar intervals
- Automatic preventive MWO creation on cycle threshold (via `mes.cycle.recorded` subscriber)
- Manual calendar trigger evaluation via `evaluateCalendarTriggers()`
- Maintenance work order lifecycle (open → in progress → completed)
- Due-soon / overdue dashboard queries

## Events

See [EVENTS.md](./EVENTS.md).
