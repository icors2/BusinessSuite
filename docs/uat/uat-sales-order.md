# UAT — Sales Orders

**Module:** Sales Order  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [sales-order.md](../training/modules/sales-order.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | Sales Orders nav visible | | | |
| 2 | Open accepted quote from CPQ UAT | Quote detail shows Accepted | | | |
| 3 | **Convert** quote to sales order | SO created with line items | | | |
| 4 | **Allocate** order | Allocation progress shown; inventory reserved or backorder flagged | | | |
| 5 | **Confirm shipment** for allocatable lines | Status SHIPPED/PARTIALLY_SHIPPED; WMS decremented | | | |
| 6 | Verify linked invoice posted | Invoice POSTED in Finance | | | |
| 7 | Open seeded `SO-SEED-001` | Shipped lines visible (for Returns UAT) | | | |
