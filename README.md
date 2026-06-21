# Arc N Code Business Suite

Integrated manufacturing operations platform — **all phases complete** (Phase 17 Training, UAT & Change Management).

## Prerequisites

- Node.js 22+
- npm 11+
- Docker Desktop (for local Postgres, Redis, MinIO, API)
- Optional: GPG (for encrypted backups)

## Quick start (local development)

1. **Clone and install**
   ```bash
   git clone <repo-url> anc-business-suite
   cd anc-business-suite
   npm ci
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit secrets for non-dev environments
   ```

3. **Start infrastructure**
   ```bash
   docker compose up -d postgres redis minio
   ```

4. **Database setup**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate:deploy
   npm run prisma:seed
   ```

5. **Run API**
   ```bash
   npm run serve
   # API: http://localhost:3000/api
   # tRPC: http://localhost:3000/trpc
   # Health: http://localhost:3000/api/health
   ```

6. **Run ERP Admin UI (Phase 1)**
   ```bash
   npm run serve:web
   # Web: http://localhost:4200 (proxies /api and /trpc to port 3000)
   ```

7. **Full stack in Docker (API + Web UI + infrastructure)**
   ```bash
   docker compose up -d --build
   ```
   | Service | URL |
   |---------|-----|
   | **Web UI** | http://localhost:8080 |
   | **API** | http://localhost:3000/api |
   | **Health** | http://localhost:3000/api/health |

   Nginx in the `web` container serves the built React app and proxies `/api`, `/trpc`, and `/mes` to the `api` service.

   For **hot-reload UI development**, keep using step 6 (`npm run serve:web` on port 4200) with infrastructure from step 3.

## Seeded users (development)

| Email | Password | Role |
|-------|----------|------|
| admin@arcncode.local | Admin123! | Admin |
| manager@arcncode.local | Manager123! | Manager |
| viewer@arcncode.local | Viewer123! | Viewer (read-only) |
| operator@arcncode.local | Operator123! | Operator |
| supervisor@arcncode.local | Supervisor123! | Supervisor |
| inspector@arcncode.local | Inspector123! | Inspector |
| technician@arcncode.local | Technician123! | Technician |
| support@arcncode.local | Support123! | Support |

Sample master data (products with list prices, customer with price tier, vendor), finance seed data (Chart of Accounts, sample AR/AP), a sample PLM document (metadata-only DRAFT revision on SKU-001), WMS seed data (MAIN warehouse, bins A-01-01/A-01-02 with on-hand for SKU-001/SKU-002), CPQ seed data (demo materials, catalog parts, rate card, sample draft quote Q-SEED-CPQ-001), sales seed data (sample order SO-SEED-001 with allocated product + MTO fabricated line), MPS seed data (LINE-MAIN production line, 30-day factory calendar, sample work order), MRP seed data (SKU-001 MAKE with 2-level BOM, BUY components with lead times), procurement seed data (issued PO PO-2026-SEED1 with sample receipt for scorecard), workforce seed data (EMP-0001, DAY shift, assignment, closed time entry on seeded work order), MES seed data (WS-LASER workstation, 2 sequential operations on seeded WO, closed cycle for EMP-0001), QMS seed data (TMPL-FINAL checklist, passing inspection on seeded WO), and CMMS seed data (ASSET-LASER linked to WS-LASER, cycle + calendar PM rules, open corrective MWO) are seeded after migration.

## API endpoints

### REST (auth)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api` | Public | Service info |
| GET | `/api/health` | Public | DB/Redis/MinIO health |
| POST | `/api/auth/register` | Public | Register user |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| POST | `/api/auth/refresh` | Public | Refresh tokens |
| GET | `/api/auth/admin-only` | Admin | Role-gated test |
| GET | `/api/auth/manager-or-admin` | Admin, Manager | Role-gated test |

### REST (documents — Phase 4)

Binary upload/download; metadata and lifecycle via tRPC `document` router.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/documents/:documentId/revisions` | Admin, Manager | Multipart file upload (new revision) |
| GET | `/api/documents/revisions/:revisionId/download` | Authenticated | Stream revision bytes from MinIO |

### tRPC (master data)

Mounted at `/trpc`. Authenticated reads for all roles; writes require Admin or Manager.

| Router | Procedures |
|--------|------------|
| `product` | create, get, list, update, deactivate |
| `customer` | create, get, list, update, deactivate |
| `vendor` | create, get, list, update, deactivate |

### tRPC (finance — Phase 3)

Double-entry ledger; invoices/bills auto-post balanced journal entries.

| Router | Procedures |
|--------|------------|
| `account` | create, get, list, update, deactivate |
| `journal` | create, get, list, post, reverse |
| `invoice` | create, get, list, post, void, recordPayment |
| `bill` | create, get, list, post, void, recordPayment |
| `report` | profitAndLoss, balanceSheet |

### tRPC (PLM — Phase 4)

Immutable revision history; status flow Draft → In Review → Released → Obsolete.

| Router | Procedures |
|--------|------------|
| `document` | create, get, listByProduct, revisions, transition |

### tRPC (WMS — Phase 5)

Inventory movements and lookups; `available = onHand - allocated`.

| Router | Procedures |
|--------|------------|
| `inventory` | createLocation, listLocations, createBin, listBins, receive, move, pick, ship, adjust, allocate, deallocate, byProduct, byBin, byLocation |

### tRPC (CPQ — Phase 6)

FabQuote-derived costing engine + rule-based product pricing; quote lifecycle with snapshot freeze on send.

| Router | Procedures |
|--------|------------|
| `quote` | create, get, list, addProductLine, addFabricatedLine, updateLine, removeLine, recalc, transition, pricePreview |
| `cpqCatalog` | searchMaterials, searchParts, searchProducts, getSettings, updateRateCard, updatePricingConfig, updateFormulas (Admin) |

## ERP Admin UI (CPQ pages)

| Route | Description |
|-------|-------------|
| `/cpq/quotes` | Quote list with status badges |
| `/cpq/quotes/new` | Create new quote |
| `/cpq/quotes/:id` | Quote editor (product + fabricated lines, send/accept/reject, print/CSV) |
| `/cpq/catalog` | Digital product catalog with live tier/volume pricing |

### tRPC (Sales — Phase 7)

Quote-to-order conversion, WMS allocation, shipment + Finance invoicing.

| Router | Procedures |
|--------|------------|
| `salesOrder` | convert, get, list, allocate, confirmShipment, cancel |

## ERP Admin UI (Sales pages)

| Route | Description |
|-------|-------------|
| `/sales/orders` | Order list with status/backorder badges |
| `/sales/orders/:id` | Order detail (allocation progress, ship, cancel, invoice links) |

### tRPC (MPS — Phase 8)

Master Production Schedule: demand aggregation, net demand, capacity-aware scheduling.

| Router | Procedures |
|--------|------------|
| `mps` | previewDemand, generateSchedule, listWorkOrders, getWorkOrder, listLines, getCalendar, rescheduleWorkOrder, upsertLine, upsertCalendarDay, setStrategy, setProductStrategy, listSettings |

## ERP Admin UI (MPS pages)

| Route | Description |
|-------|-------------|
| `/mps/dashboard` | MPS dashboard (demand preview, work order timeline, overload warnings, reschedule) |

### tRPC (MRP — Phase 9)

Material Requirements Planning: multi-level BOM explosion, net demand, purchase requisitions.

| Router | Procedures |
|--------|------------|
| `mrp` | runMrp, getRequirements, listRequisitions, getBom, reviewRequisition, upsertBom |

## ERP Admin UI (MRP pages)

| Route | Description |
|-------|-------------|
| `/mrp/procurement` | Procurement (run MRP, exploded requirements, suggested requisitions with approve/reject/adjust) |

### tRPC (Procurement — Phase 10)

Purchase orders from approved requisitions, vendor acknowledgment/ASN intake, receive-against-PO, and vendor scorecards.

| Router | Procedures |
|--------|------------|
| `procurement` | createPurchaseOrders, issuePurchaseOrder, acknowledgePurchaseOrder, submitAsn, receiveAgainstPo, listPurchaseOrders, getPurchaseOrder, getVendorScorecard |

## ERP Admin UI (Procurement pages)

| Route | Description |
|-------|-------------|
| `/procurement/purchase-orders` | PO creation from approved requisitions, issue/acknowledge/ASN/receive actions |
| `/procurement/scorecard` | Vendor on-time delivery and quantity-accuracy metrics |

### tRPC (Workforce — Phase 11)

Shift scheduling, kiosk time clock, and labor cost roll-up by work order and department.

| Router | Procedures |
|--------|------------|
| `workforce` | createEmployee, updateEmployee, upsertShift, assignShift, markUnavailable, clockIn, clockOut, listEmployees, listShifts, listAssignments, listOpenTimeEntries, getLaborCostReport |

## ERP Admin UI (Workforce pages)

| Route | Description |
|-------|-------------|
| `/workforce/schedule` | Shift grid, assign employees, coverage gaps, mark unavailable |
| `/workforce/time-clock` | Tablet-friendly kiosk — roster tap or badge code clock in/out |
| `/workforce/labor-cost` | Labor cost roll-up by work order and department |

### tRPC (MES — Phase 12)

Shop floor execution: workstations, sequential work-order operations, cycle records attributed to clocked-in operators, supervisor verification, placards.

| Router | Procedures |
|--------|------------|
| `mes` | upsertWorkstation, upsertOperation, generateOperations, startOperation, stopOperation, verifyWorkOrder, listWorkstations, listOperations, listOpenCycles, getDashboard, getPlacard |

## ERP Admin UI (MES pages)

| Route | Description |
|-------|-------------|
| `/mes/operator-console` | Tablet kiosk — start/stop operations, qty entry, operator from clocked-in roster |
| `/mes/supervisor` | Live floor dashboard (Socket.IO `/mes`) + verification with photo upload |
| `/mes/scheduling` | Operations-by-workstation board with live updates |
| `/mes/placard` | Printable work-order traveler with Code128 barcode |

Real-time updates use a NestJS Socket.IO gateway (`/mes` namespace) fed by `mes.*` events on the Redis event bus.

### tRPC (QMS — Phase 13)

Quality management: configurable inspection templates, inspector-completed checklists with photo-per-criterion evidence, non-conformance records with hold flags that block MES/WMS until disposition.

| Router | Procedures |
|--------|------------|
| `qms` | upsertTemplate, addCriterion, completeInspection, raiseNonConformance, reportScrap, disposition, listTemplates, getTemplate, listInspections, getInspection, listNonConformances, getNonConformance |

## ERP Admin UI (QMS pages)

| Route | Description |
|-------|-------------|
| `/qms/inspection` | Tablet inspector UI — complete pass/fail + measured checklists |
| `/qms/checklist-builder` | Admin template builder (pass/fail + measurement criteria) |
| `/qms/non-conformance` | NC list with HOLD badges + supervisor disposition workflow |

Hold behavior: `HOLD` severity sets `WorkOrder.onHold` and/or `Bin.onHold`; MES blocks start/verify and WMS blocks pick/ship until disposition clears all open holds.

### tRPC (CMMS — Phase 14)

Maintenance management: assets linked to MES workstations, PM trigger rules (cycle-count and calendar), automatic preventive MWO generation from `mes.cycle.recorded`, maintenance work order lifecycle, due-soon/overdue dashboard.

| Router | Procedures |
|--------|------------|
| `cmms` | upsertAsset, upsertPmRule, createMaintenanceWorkOrder, cancelMaintenanceWorkOrder, evaluateCalendarTriggers, startMaintenanceWorkOrder, completeMaintenanceWorkOrder, listAssets, getAsset, listPmRules, listMaintenanceWorkOrders, getMaintenanceWorkOrder, getDueSoon, getMaintenanceHistoryForWorkOrder |

## ERP Admin UI (CMMS pages)

| Route | Description |
|-------|-------------|
| `/cmms/assets` | Asset list with due/overdue indicators, PM rule config, calendar trigger evaluation |
| `/cmms/work-orders` | Maintenance WO queue with due-soon filter; start/complete gated to Technician+ |

Cycle-based PM is driven by `CmmsCycleSubscriber` on `mes.cycle.recorded` (consumer group `cmms-pm`). Calendar PM is evaluated via `evaluateCalendarTriggers()` (tRPC/manual).

### tRPC (Returns — Phase 15)

Returns & RMA: request against shipped sales order lines within a configurable return window, approval/rejection, WMS receiving into a returns bin, optional QMS non-conformance for quality returns, and refund resolution via Finance credit memo.

| Router | Procedures |
|--------|------------|
| `returns` | requestRma, approveRma, rejectRma, receiveRma, resolveRma, listRmas, getRma |

Support role (or Supervisor/Manager/Admin) required for lifecycle mutations; reads are authenticated.

## ERP Admin UI (Returns pages)

| Route | Description |
|-------|-------------|
| `/returns/queue` | RMA queue with status filters; request RMA against shipped order lines |
| `/returns/:id` | RMA detail — linked order, customer, NC, credit memo; lifecycle actions gated to Support+ |

Default returns bin: `RET-01` in `RETURNS` location (seeded). Refund resolution posts a `CreditMemo` (DR Revenue 4000, CR AR 1100).

### tRPC (Analytics — Phase 16)

Event ingestion, deterministic natural-language querying, MES bottleneck detection, and inventory demand forecasting.

| Router | Procedures |
|--------|------------|
| `analytics` | ask, getEventVolume, getScrapRate, getBottlenecks, getForecasts, getIngestionStatus, recomputeForecasts |

**Data freshness:** events ingested in real-time via `AnalyticsIngestionSubscriber` (consumer group `analytics-ingest`); scrap/bottleneck metrics are near-real-time from operational tables; forecasts are batch-computed on demand.

## ERP Admin UI (Analytics pages)

| Route | Description |
|-------|-------------|
| `/analytics/dashboard` | Event volume, scrap rate, ingestion status with freshness labels |
| `/analytics/ask` | Natural-language Q&A (deterministic offline parser) |
| `/analytics/bottlenecks` | WIP pileup by workstation (Supervisor+) |
| `/analytics/forecast` | Inventory depletion/reorder projections (Editor+ recompute) |

## Data migration (Phase 2)

CLI ETL from legacy exports into the Master Data schema. Staging-first,
idempotent, with a reconciliation report and cutover/rollback runbooks. Map the
legacy export to the [expected schema](docs/migration-expected-schema.md)
(CSV or JSON), then:

```bash
# ingest + reconcile in one step (review before promoting)
npm run migrate:run -- --source legacy-erp --dir data/legacy-samples

# or step-by-step
npm run migrate:ingest    -- --source legacy-erp --dir data/legacy-samples
npm run migrate:reconcile -- --batch <batchId>
npm run migrate:promote   -- --batch <batchId>
npm run migrate:rollback  -- --batch <batchId>
```

- Staging tables: `MigrationBatch`, `StagingCustomer/Vendor/Product/Quote`
- Conflicts (missing fields, duplicate `sourceId`) are flagged, never dropped
- Quotes staged in `StagingQuote` can be promoted once validated against production `Quote` records (Phase 6)
- Runbooks: [cutover](docs/migration-cutover-runbook.md), [rollback](docs/migration-rollback-procedure.md)

## Environment separation

| Environment | Config source | Notes |
|-------------|---------------|-------|
| **Development** | `.env` (from `.env.example`) | Default dev secrets OK |
| **Staging** | Host env / `.env.staging` | Strong JWT secrets required |
| **Production** | Platform secret store on on-prem host | Never commit secrets |

### Promotion path

1. Develop locally with `.env`
2. CI injects secrets via GitHub Actions secrets (see `.github/workflows/ci.yml`)
3. Staging/production: set env vars on the Docker host or use a vault (HashiCorp Vault documented as future step)

## Secrets management

- **Local:** `.env` file (gitignored), copy from `.env.example`
- **CI:** GitHub repository secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, etc.)
- **Production:** On-prem Docker host environment or vault — document in deployment runbook

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build API |
| `npm run build:web` | Build ERP Admin UI |
| `npm run serve` | Run API in dev mode |
| `npm run serve:web` | Run ERP Admin UI (Vite, port 4200) |
| `npm run test` | Run all tests |
| `npm run lint` | ESLint all projects |
| `npm run prisma:migrate` | Create/apply dev migrations |
| `npm run prisma:seed` | Seed Admin/Manager roles and users |
| `npm run migrate:run` | Ingest + reconcile a legacy migration batch |
| `npm run migrate:promote` | Promote a reviewed batch into production |
| `npm run migrate:rollback` | Undo a promoted batch |
| `npm run docker:up` | Start full Docker stack (Postgres, Redis, MinIO, API, Web UI on :8080) |
| `npm run backup` | Encrypted Postgres backup |

## Architecture

```
apps/api          NestJS modular monolith (REST auth + tRPC master data)
apps/web          React ERP Admin UI (Vite, Tailwind, Shadcn-style components)
libs/masterdata   Product, Customer, Vendor domain services + events
libs/trpc         tRPC init, JWT context, composed AppRouter
libs/migration    Legacy ETL: extract/transform/load/reconcile/promote/rollback
libs/finance      Chart of Accounts, journal entries, AR/AP, payments, reports
libs/plm          Document control, revision lifecycle, PLM events
libs/wms          Locations, bins, inventory quantities, movements
libs/cpq          FabQuote engine, quotes, CPQ catalog, sales events
libs/sales        Sales orders, WMS allocation, fulfillment, invoice-on-ship
libs/mps          Master Production Schedule, work orders, factory calendar
libs/mrp          Material Requirements Planning, BOM explosion, requisitions
libs/procurement  Purchase orders, vendor intake, receive-against-PO, scorecards
libs/workforce    Employees, shifts, time clock, labor cost roll-up
libs/mes          Workstations, operations, cycles, verification, placards, Socket.IO gateway
libs/qms          Inspection templates, records, non-conformance, hold enforcement
libs/cmms         Assets, PM trigger rules, maintenance work orders, cycle subscriber
libs/returns      RMA lifecycle, return window, WMS receive, QMS NC, credit memo refund
libs/analytics    Event ingestion, NLQ, bottleneck detection, inventory forecasting
scripts/migrate.ts  Migration CLI entrypoint
libs/shared/
  config          Typed environment loader
  database        Prisma + PostgreSQL
  event-bus       Redis Streams pub/sub
  audit           Audit logging to Postgres
  health          /health watchdog
  auth            JWT + RBAC (Admin, Manager, Viewer, Operator, Supervisor, Inspector, Technician, Support)
  storage         MinIO/S3 object storage wrapper
```

## Training & UAT (Phase 17)

Role-based user guides, persona onboarding, UAT scripts, support process, and sign-off tracker:

| Resource | Location |
|----------|----------|
| Training index | [docs/training/README.md](docs/training/README.md) |
| Module guides (14) | [docs/training/modules/](docs/training/modules/) |
| Persona quick-starts (10) | [docs/training/onboarding/](docs/training/onboarding/) |
| UAT scripts | [docs/uat/](docs/uat/) |
| UAT master tracker | [docs/uat/uat-master-tracker.md](docs/uat/uat-master-tracker.md) |
| Support & feedback process | [docs/support/support-feedback-process.md](docs/support/support-feedback-process.md) |
| Tickets log (sample ticket) | [docs/support/tickets-log.md](docs/support/tickets-log.md) |

## Backup & restore

See [docs/backup-restore-runbook.md](docs/backup-restore-runbook.md).

## Field deployment (on-site installs)

See [docs/field-deployment-sop.md](docs/field-deployment-sop.md) for field technician SOP covering network setup, server wiring, and site verification.

- **RPO:** ≤ 24 hours (nightly backups)
- **RTO:** ≤ 4 hours

## CI/CD

GitHub Actions runs lint, type-check, test, and build on every push. Tagged releases (`v*`) trigger the manual self-hosted Docker deploy step.

## Phase roadmap

See [Arc_N_Code_AI_Build_Prompts_v6.md](Arc_N_Code_AI_Build_Prompts_v6.md) for the full build sequence (Phases 0–17).

**Phase 0 status:** Complete  
**Phase 0.5 status:** Complete  
**Phase 1 status:** Complete  
**Phase 2 status:** Complete  
**Phase 3 status:** Complete  
**Phase 4 status:** Complete  
**Phase 5 status:** Complete  
**Phase 6 status:** Complete  
**Phase 7 status:** Complete  
**Phase 8 status:** Complete  
**Phase 9 status:** Complete  
**Phase 10 status:** Complete  
**Phase 11 status:** Complete  
**Phase 12 status:** Complete  
**Phase 13 status:** Complete  
**Phase 14 status:** Complete  
**Phase 15 status:** Complete  
**Phase 16 status:** Complete  
**Phase 17 status:** Complete  
**Build status:** All phases (0–17) complete
