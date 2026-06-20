# UAT — Analytics

**Module:** Analytics  
**Demo login:** `manager@arcncode.local` / `Manager123!`  
**Guide:** [analytics.md](../training/modules/analytics.md)

| Step | Action | Expected Result | Pass/Fail | Tester | Date |
|------|--------|-----------------|-----------|--------|------|
| 1 | Sign in as Manager | Analytics nav (Dashboard, Ask, Bottlenecks, Forecast) visible | | | |
| 2 | Open **Dashboard** | Event volume chart and scrap rate display | | | |
| 3 | Check **Ingestion status** | Status complete/near-real-time; freshness label shown | | | |
| 4 | Open **Ask** → query "scrap rate last month" | Deterministic answer with scrap metrics | | | |
| 5 | Open **Bottlenecks** | WIP pileup list; may show `WS-LASER` from seed | | | |
| 6 | Open **Forecast** | Inventory depletion/reorder projections listed | | | |
| 7 | Click **Recompute forecasts** | Forecasts refreshed; updated timestamp | | | |
| 8 | Sign in as Viewer → read-only analytics | Dashboard/Ask work; recompute hidden/denied | | | |
