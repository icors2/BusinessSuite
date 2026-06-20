# UAT — CPQ

**Module:** CPQ  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [cpq.md](../training/modules/cpq.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | CPQ Quotes and Catalog nav visible | | | |
| 2 | Create new quote for seeded customer | Quote in Draft status | | | |
| 3 | Add product line `SKU-001` qty 5 | Line appears with pricing | | | |
| 4 | Add fabricated plate line | Fab line with material/labor cost | | | |
| 5 | Click **Recalc** | Totals refresh | | | |
| 6 | Transition quote to **Sent** | Status Sent; snapshot frozen | | | |
| 7 | Transition to **Accepted** | Status Accepted; ready for SO conversion | | | |
| 8 | Open **Catalog** → search `SKU-001` | Tier/volume pricing preview shown | | | |
