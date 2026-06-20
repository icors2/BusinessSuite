# Arc N Code Business Suite

Integrated manufacturing operations platform — Phase 7 Sales Order Management & Fulfillment complete.

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

7. **Full stack (including API container)**
   ```bash
   docker compose up -d
   ```

## Seeded users (development)

| Email | Password | Role |
|-------|----------|------|
| admin@arcncode.local | Admin123! | Admin |
| manager@arcncode.local | Manager123! | Manager |
| viewer@arcncode.local | Viewer123! | Viewer (read-only) |

Sample master data (products with list prices, customer with price tier, vendor), finance seed data (Chart of Accounts, sample AR/AP), a sample PLM document (metadata-only DRAFT revision on SKU-001), WMS seed data (MAIN warehouse, bins A-01-01/A-01-02 with on-hand for SKU-001/SKU-002), CPQ seed data (demo materials, catalog parts, rate card, sample draft quote Q-SEED-CPQ-001), and sales seed data (sample order SO-SEED-001 with allocated product + MTO fabricated line) are seeded after migration.

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
| `npm run docker:up` | Start full Docker stack |
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
scripts/migrate.ts  Migration CLI entrypoint
libs/shared/
  config          Typed environment loader
  database        Prisma + PostgreSQL
  event-bus       Redis Streams pub/sub
  audit           Audit logging to Postgres
  health          /health watchdog
  auth            JWT + RBAC (Admin, Manager, Viewer)
  storage         MinIO/S3 object storage wrapper
```

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
**Next phase:** Phase 8 — MPS (Production Scheduling)
