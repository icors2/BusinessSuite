# UAT — Workforce

**Module:** Workforce  
**Demo login:** `manager@arcncode.local` (schedule), `operator@arcncode.local` (kiosk)  
**Guide:** [workforce.md](../training/modules/workforce.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | Workforce nav visible | | | |
| 2 | Open **Schedule** | Shift grid with seeded assignments | | | |
| 3 | Assign operator to a shift | Assignment saved; coverage updated | | | |
| 4 | Sign out; sign in as `operator@arcncode.local` | Operator role active | | | |
| 5 | Open **Time Clock** → clock in | Open time entry created | | | |
| 6 | Verify operator on open roster (MES prep) | Name appears in clocked-in list | | | |
| 7 | Clock out | Time entry closed; hours recorded | | | |
| 8 | Sign in as Manager → **Labor Cost** | Report shows hours/cost by WO/dept | | | |
