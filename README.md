# Arc N Code Business Suite

Integrated manufacturing operations platform — Phase 2 data migration tooling complete.

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

Sample master data (products, customer, vendor) is seeded after migration.

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

### tRPC (master data)

Mounted at `/trpc`. Authenticated reads for all roles; writes require Admin or Manager.

| Router | Procedures |
|--------|------------|
| `product` | create, get, list, update, deactivate |
| `customer` | create, get, list, update, deactivate |
| `vendor` | create, get, list, update, deactivate |

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
- Quotes + inventory balances are staged and held for Phases 6/5
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
scripts/migrate.ts  Migration CLI entrypoint
libs/shared/
  config          Typed environment loader
  database        Prisma + PostgreSQL
  event-bus       Redis Streams pub/sub
  audit           Audit logging to Postgres
  health          /health watchdog
  auth            JWT + RBAC (Admin, Manager, Viewer)
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
**Next phase:** Phase 3 — Finance & Accounting Core
