# UAT — ERP Admin (Products, Customers, Vendors)

**Module:** ERP Admin  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [erp-admin.md](../training/modules/erp-admin.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | Dashboard loads; nav shows Products, Customers, Vendors | | | |
| 2 | Open **Products** | List shows seeded `SKU-001`, `SKU-002` | | | |
| 3 | Open `SKU-001` detail | Product fields display (description, UOM, list price) | | | |
| 4 | Create test product `UAT-SKU-001` | Product saved; appears in list | | | |
| 5 | Open **Customers** | Seeded customers visible | | | |
| 6 | Create test customer `UAT Customer` | Customer saved | | | |
| 7 | Open **Vendors** | Seeded vendors visible | | | |
| 8 | Sign out; sign in as `viewer@arcncode.local` | Read-only access; no create/save buttons | | | |
