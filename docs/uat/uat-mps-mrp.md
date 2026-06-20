# UAT — MPS & MRP

**Module:** MPS / MRP  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [mps-mrp.md](../training/modules/mps-mrp.md)

## MPS scenarios

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | MPS Dashboard nav visible | | | |
| 2 | Open **MPS Dashboard** → demand preview | Demand rows for seeded products | | | |
| 3 | **Generate schedule** | Work orders created on lines (e.g. LINE-A) | | | |
| 4 | Review timeline / overload warnings | WO bars render; warnings if over capacity | | | |
| 5 | **Reschedule** a work order | New date/line applied | | | |

## MRP scenarios

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 6 | Open **MRP Procurement** | Requirements page loads | | | |
| 7 | **Run MRP** | Exploded requirements computed | | | |
| 8 | Review suggested requisitions | Requisitions listed with quantities | | | |
| 9 | **Approve** a requisition | Status approved; available for PO creation | | | |
