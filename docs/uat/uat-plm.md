# UAT — PLM

**Module:** PLM  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [plm.md](../training/modules/plm.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | PLM Documents nav visible | | | |
| 2 | Open **Documents**; filter by `SKU-001` | Product-linked documents listed | | | |
| 3 | Create document `UAT Drawing` for `SKU-001` | Document created in Draft | | | |
| 4 | Upload revision (file) | New revision number assigned | | | |
| 5 | Transition revision to **In Review** | Status updates | | | |
| 6 | Transition to **Released** | Status Released; download enabled | | | |
| 7 | Download released revision | File streams successfully | | | |
