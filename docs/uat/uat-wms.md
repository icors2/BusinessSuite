# UAT — WMS

**Module:** WMS  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [wms.md](../training/modules/wms.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | WMS nav (Receive, Move, Pick, Inventory) visible | | | |
| 2 | Open **Inventory** → by product `SKU-001` | On-hand and available quantities shown | | | |
| 3 | **Receive** 10 units of `SKU-001` into bin `A-01-01` | On-hand increases by 10 | | | |
| 4 | **Move** 5 units from `A-01-01` to another bin | Source decreases; destination increases | | | |
| 5 | **Pick** 2 units from source bin | On-hand decreases; pick recorded | | | |
| 6 | Verify `available = onHand - allocated` on detail | Math correct | | | |
| 7 | Confirm returns bin `RET-01` exists | Location RETURNS, bin RET-01 listed | | | |
