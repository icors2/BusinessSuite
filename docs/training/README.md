# Training & UAT Documentation

Phase 17 deliverables: role-based user guides, persona onboarding, UAT scripts, support process, and sign-off tracker. All content describes **built behavior only** (routers, UI routes, RBAC, seed data).

## Module user guides (14)

| Module | Guide |
|--------|-------|
| ERP Admin (Products, Customers, Vendors) | [modules/erp-admin.md](./modules/erp-admin.md) |
| Finance | [modules/finance.md](./modules/finance.md) |
| PLM | [modules/plm.md](./modules/plm.md) |
| WMS | [modules/wms.md](./modules/wms.md) |
| CPQ | [modules/cpq.md](./modules/cpq.md) |
| Sales Orders | [modules/sales-order.md](./modules/sales-order.md) |
| MPS & MRP | [modules/mps-mrp.md](./modules/mps-mrp.md) |
| Procurement | [modules/procurement.md](./modules/procurement.md) |
| Workforce | [modules/workforce.md](./modules/workforce.md) |
| MES | [modules/mes.md](./modules/mes.md) |
| QMS | [modules/qms.md](./modules/qms.md) |
| CMMS | [modules/cmms.md](./modules/cmms.md) |
| Returns | [modules/returns.md](./modules/returns.md) |
| Analytics | [modules/analytics.md](./modules/analytics.md) |

## Persona onboarding (10)

| Persona | RBAC mapping | Quick start |
|---------|--------------|-------------|
| Operator | Operator | [onboarding/operator.md](./onboarding/operator.md) |
| Supervisor | Supervisor | [onboarding/supervisor.md](./onboarding/supervisor.md) |
| Inspector | Inspector | [onboarding/inspector.md](./onboarding/inspector.md) |
| Technician | Technician | [onboarding/technician.md](./onboarding/technician.md) |
| Sales Rep | Manager (CPQ/Sales) | [onboarding/sales-rep.md](./onboarding/sales-rep.md) |
| Planner | Manager (MPS/MRP/Analytics) | [onboarding/planner.md](./onboarding/planner.md) |
| Buyer | Manager (Procurement) | [onboarding/buyer.md](./onboarding/buyer.md) |
| Finance | Manager (Finance) | [onboarding/finance.md](./onboarding/finance.md) |
| Support | Support | [onboarding/support.md](./onboarding/support.md) |
| Admin | Admin | [onboarding/admin.md](./onboarding/admin.md) |

## UAT scripts

- [Master sign-off tracker](../uat/uat-master-tracker.md)
- Individual scripts: [../uat/](../uat/) (`uat-<module>.md`)

## Support & change management

- [Support & feedback process](../support/support-feedback-process.md)
- [Tickets log](../support/tickets-log.md) (includes worked sample ticket SUP-2026-0001)

## Demo environment

After `npm run db:seed`, sign in with `<role>@arcncode.local` / `<Role>123!` (e.g. `admin@arcncode.local` / `Admin123!`).

See [README.md](../../README.md) for full API/tRPC reference and phase status.
