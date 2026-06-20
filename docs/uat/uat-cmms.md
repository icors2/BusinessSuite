# UAT — CMMS

**Module:** CMMS  
**Demo login:** `technician@arcncode.local` (MWO), `manager@arcncode.local` (config)  
**Guide:** [cmms.md](../training/modules/cmms.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager → **Assets** | Asset on `WS-LASER` with due/overdue indicators | | | |
| 2 | Review PM rule (cycle or calendar) | Rule configured for asset | | | |
| 3 | Run MES cycles (MES UAT) or **Evaluate calendar triggers** | PM MWO auto-created or manual trigger fires | | | |
| 4 | Open **Maintenance Work Orders** | MWO in queue (due-soon filter) | | | |
| 5 | Sign in as Technician → **Start** MWO | Status IN_PROGRESS | | | |
| 6 | **Complete** MWO with notes | Status COMPLETED; history recorded | | | |
| 7 | Verify **Due Soon** dashboard updates | Next due date recalculated | | | |
