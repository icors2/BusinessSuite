# UAT — Returns & RMA

**Module:** Returns  
**Demo login:** `support@arcncode.local` / `Support123!`  
**Guide:** [returns.md](../training/modules/returns.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Support | Returns Queue nav visible | | | |
| 2 | Open **Returns Queue** | RMA list loads | | | |
| 3 | **Request RMA** on shipped line from `SO-SEED-001` | RMA REQUESTED with qty/reason | | | |
| 4 | **Approve** RMA | Status APPROVED | | | |
| 5 | **Receive** RMA into bin `RET-01` | WMS qty in RETURNS location increased | | | |
| 6 | **Resolve** with REFUND disposition | RMA RESOLVED | | | |
| 7 | Verify credit memo in Finance | Credit memo posted (DR 4000, CR 1100) | | | |
| 8 | (Optional) Reject path: request → reject | Status REJECTED; no receive allowed | | | |
