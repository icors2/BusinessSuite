# UAT — MES

**Module:** MES  
**Demo login:** `operator@arcncode.local` (console), `supervisor@arcncode.local` (verify)  
**Guide:** [mes.md](../training/modules/mes.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Operator clocks in (Workforce UAT step 5) | Clocked-in roster entry active | | | |
| 2 | Sign in as Operator → **Operator Console** | Workstations/operations listed | | | |
| 3 | Start operation on `WS-LASER` | Cycle started; timer running | | | |
| 4 | Stop operation with qty completed | Cycle recorded; `mes.cycle.recorded` event | | | |
| 5 | Sign in as Supervisor → **Supervisor Dashboard** | Live cycle updates via Socket.IO | | | |
| 6 | **Verify** completed work order | WO verified status; optional photo saved | | | |
| 7 | Open **Scheduling** board | Operations grouped by workstation | | | |
| 8 | Open **Placard** for work order | Printable traveler with Code128 barcode | | | |
