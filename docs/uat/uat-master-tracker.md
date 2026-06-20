# UAT Master Sign-Off Tracker

Master tracker for module user acceptance testing. Scripts are authored and ready for end-user execution; initial status is **Not Started** until testers complete each script and record sign-off.

**Process:** [Support & feedback](../support/support-feedback-process.md) · **Training index:** [docs/training/README.md](../training/README.md)

| Module | User Guide | UAT Script | Status | Sign-off (name / date) | Release Milestone |
|--------|------------|------------|--------|------------------------|-------------------|
| ERP Admin | [erp-admin.md](../training/modules/erp-admin.md) | [uat-erp-admin.md](./uat-erp-admin.md) | Not Started | | MVP |
| Finance | [finance.md](../training/modules/finance.md) | [uat-finance.md](./uat-finance.md) | Not Started | | Revenue |
| PLM | [plm.md](../training/modules/plm.md) | [uat-plm.md](./uat-plm.md) | Not Started | | Enterprise |
| WMS | [wms.md](../training/modules/wms.md) | [uat-wms.md](./uat-wms.md) | Not Started | | Execution |
| CPQ | [cpq.md](../training/modules/cpq.md) | [uat-cpq.md](./uat-cpq.md) | Not Started | | Revenue |
| Sales Order | [sales-order.md](../training/modules/sales-order.md) | [uat-sales-order.md](./uat-sales-order.md) | Not Started | | Revenue |
| MPS / MRP | [mps-mrp.md](../training/modules/mps-mrp.md) | [uat-mps-mrp.md](./uat-mps-mrp.md) | Not Started | | Planning |
| Procurement | [procurement.md](../training/modules/procurement.md) | [uat-procurement.md](./uat-procurement.md) | Not Started | | Planning |
| Workforce | [workforce.md](../training/modules/workforce.md) | [uat-workforce.md](./uat-workforce.md) | Not Started | | Execution |
| MES | [mes.md](../training/modules/mes.md) | [uat-mes.md](./uat-mes.md) | Not Started | | Execution |
| QMS | [qms.md](../training/modules/qms.md) | [uat-qms.md](./uat-qms.md) | Not Started | | Execution |
| CMMS | [cmms.md](../training/modules/cmms.md) | [uat-cmms.md](./uat-cmms.md) | Not Started | | Execution |
| Returns | [returns.md](../training/modules/returns.md) | [uat-returns.md](./uat-returns.md) | Not Started | | Revenue |
| Analytics | [analytics.md](../training/modules/analytics.md) | [uat-analytics.md](./uat-analytics.md) | Not Started | | Enterprise |

## Status legend

| Status | Meaning |
|--------|---------|
| Not Started | Script ready; no tester execution yet |
| In Progress | Testing underway; failures logged in tickets-log |
| Passed | All script steps Pass; sign-off recorded |

## Recommended execution order

1. ERP Admin → Finance → WMS (foundation)
2. CPQ → Sales Order → Returns (order-to-cash)
3. MPS/MRP → Procurement (plan-to-buy)
4. Workforce → MES → QMS → CMMS (shop floor)
5. PLM, Analytics (cross-cutting)

## Demo logins (all `@arcncode.local`, password `<Role>123!`)

`admin`, `manager`, `viewer`, `operator`, `supervisor`, `inspector`, `technician`, `support`
