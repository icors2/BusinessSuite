# UAT — Procurement

**Module:** Procurement  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [procurement.md](../training/modules/procurement.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Complete MRP UAT step 9 (approved requisition) | At least one approved requisition exists | | | |
| 2 | Open **Purchase Orders** | PO list loads | | | |
| 3 | **Create POs** from approved requisitions | Draft PO(s) created | | | |
| 4 | **Issue** PO to vendor | Status ISSUED | | | |
| 5 | **Acknowledge** PO | Vendor acknowledgment recorded | | | |
| 6 | **Submit ASN** with expected qty/date | ASN linked to PO | | | |
| 7 | **Receive against PO** | WMS inventory increased; PO received qty updated | | | |
| 8 | Open **Vendor Scorecard** | On-time and qty-accuracy metrics display | | | |
