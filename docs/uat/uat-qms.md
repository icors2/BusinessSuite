# UAT — QMS

**Module:** QMS  
**Demo login:** `inspector@arcncode.local`, `supervisor@arcncode.local`  
**Guide:** [qms.md](../training/modules/qms.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager → **Checklist Builder** | Template list loads | | | |
| 2 | Create/verify inspection template with pass/fail + measurement criteria | Template saved | | | |
| 3 | Sign in as Inspector → **Inspection** | Active inspections listed | | | |
| 4 | Complete inspection with pass/fail and measurements | Inspection COMPLETED | | | |
| 5 | **Raise NC** with HOLD severity | NC created; WO/bin hold flags set | | | |
| 6 | Attempt MES start on held WO (Operator) | Blocked with hold message | | | |
| 7 | Sign in as Supervisor → **Non-Conformance** | NC shows HOLD badge | | | |
| 8 | **Disposition** NC (release/rework/scrap) | Holds cleared; MES/WMS unblocked | | | |
