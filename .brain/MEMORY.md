# Arc N Code Business Suite — Persistent Memory

> **Read at the start of every session.** Update when architectural decisions are made, phases complete, or repo structure changes.

---

## Project Snapshot

| Field | Value |
|-------|-------|
| **Product** | Arc N Code Business Suite — integrated manufacturing operations platform |
| **Audience** | Manufacturing businesses; deployed on-site with field technician setup |
| **Architecture** | Single Nx monorepo, NestJS modular monolith, phased delivery (Phases 0–17) |
| **Repo status** | Phase 5 complete — WMS locations/bins, inventory movements, scan-driven warehouse UI |
| **Primary build spec** | [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md) |
| **Agent rules** | [.cursor/.cursorrules.md](../.cursor/.cursorrules.md) |

Build one phase at a time, in order. Do not skip ahead. Start a fresh session per phase when possible so context stays grounded in what already exists.

---

## Current Phase

| Field | Value |
|-------|-------|
| **Active phase** | None — Phase 5 complete |
| **Next phase** | **Phase 6 — CRM & CPQ (Sales)** |
| **Last updated** | 2026-06-20 |

### Phase 5 Definition of Done

Full prompt: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 5](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-5--wms-inventory--complete)

- [x] Prisma schema: Location, Bin, InventoryQuantity, InventoryMovement, MovementType enum; Product back-relation
- [x] `libs/wms` — LocationService + InventoryService (receive/move/pick/ship/adjust/allocate/deallocate)
- [x] available = onHand - allocated; negative inventory rejected unless `allowNegative` override
- [x] tRPC `inventory` router for movements and lookups by product/bin/location
- [x] Tablet-optimized WMS UI: ScanInput, receive/move/pick flows, inventory lookup (no offline PWA)
- [x] Events: `wms.inventory.received`, `wms.inventory.moved`, `wms.inventory.shipped`, `wms.inventory.adjusted`
- [x] Unit + integration tests (movement math, allocate+pick, negative guard, Viewer block)

### Phase 4 Definition of Done

Full prompt: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 4](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-4--plm--documents--complete)

- [x] Prisma schema: Document, DocumentRevision (immutable), DocumentStatus enum; Product back-relation
- [x] `libs/shared/storage` — StorageService (MinIO/S3); object keys `documents/{documentId}/{revisionId}-{filename}`
- [x] `libs/plm` — DocumentService (create, listByProduct, addRevision, transitionStatus, download helpers)
- [x] Revision rules: Draft → In Review → Released → Obsolete; single active Released per document
- [x] REST DocumentsController for multipart upload + streamed download; tRPC document router for metadata/lifecycle
- [x] PLM UI: documents per product, revision history, image/PDF preview, editor-gated upload/transitions
- [x] Events: `plm.document.uploaded`, `plm.document.revised`, `plm.document.released` (see `libs/plm/EVENTS.md`)
- [x] Unit tests (revision increment, illegal transition, single-Released) + integration tests (MinIO round-trip, lifecycle, Viewer block)

### Phase 3 Definition of Done

Full prompt: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 3](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-3--finance--accounting-core--complete)

- [x] Prisma schema: Account, JournalEntry/Line, Invoice/Line, Bill/Line, Payment
- [x] Balanced-entry enforcement; posted entries immutable; corrections via reversing entries
- [x] Invoices/bills/payments auto-post GL; tRPC routers for all finance operations
- [x] P&L and Balance Sheet from posted journal entries; seed totals verified in integration tests
- [x] Finance admin UI: accounts, invoices, bills, reports
- [x] Events documented in `libs/finance/EVENTS.md` and emitted on state changes

### Phase 2 Definition of Done

Full prompt and deliverables: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 2](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-2--data-migration--legacy-cutover--complete)

- [x] ETL runs end-to-end against sample/legacy-shaped data without manual intervention (`libs/migration` + `scripts/migrate.ts`)
- [x] CSV/JSON extract mapped to documented expected schema; conflicts (missing fields, duplicate `sourceId`) logged to review file, never silently dropped
- [x] Staging-first load (`MigrationBatch` + `Staging*` tables); promotion to production is a separate, reviewed step
- [x] Reconciliation report: counts extracted/staged/valid/conflicts/promoted + flagged conflict samples
- [x] Idempotent re-runs (upsert on `(sourceSystem, sourceId)`; promoted rows preserved); audit trail via `AuditLog`
- [x] Cutover runbook + rollback procedure written and dry-run (promote→rollback exercised against staging copy)
- [x] Unit tests (transform/conflict/CSV) + integration ETL test (18 tests passing)

### Phase 1 Definition of Done

Full prompt and deliverables: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 1](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-1--erp-core-master-data--complete)

- [x] Products, Customers, Vendors CRUD + deactivate via ERP Admin UI
- [x] SKU uniqueness and duplicate-customer (name + billing address) validation tested
- [x] Events emit on create/update/deactivate; `MasterdataLogSubscriber` logs for verification
- [x] Role gating: Viewer can read, cannot write; Admin/Manager can write

### Phase 0.5 Definition of Done

Full prompt and deliverables: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 0.5](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-05--white-glove-physical-sop)

- [x] SOP document exists and is reviewable by a non-engineer technician
- [x] Includes a printable/checkable onsite checklist
- [x] Includes server readiness verification steps tied to Phase 0's `/health` endpoint

### Phase 0 Definition of Done

Full prompt and deliverables: [Arc_N_Code_AI_Build_Prompts_v6.md — Phase 0](../Arc_N_Code_AI_Build_Prompts_v6.md#phase-0--infrastructure-foundation)

- [x] `docker-compose up` brings up Postgres, Redis, MinIO, and the API cleanly
- [x] `/health` reports all three dependencies as connected
- [x] Login issues a token that a role-gated test endpoint correctly accepts/rejects
- [x] Event Bus has a working publish/subscribe round-trip test
- [x] Backup/restore runbook exists and has been tested at least once
- [x] CI pipeline is green on a clean clone

### Blockers / Open Questions

- **Site provisioning API (Phase 1+):** Automated registry-token / `POST /api/provision/register` not built. Field SOP documents manual interim process — see [docs/field-deployment-sop.md](../docs/field-deployment-sop.md) Section 4.

---

## Repository Map

| Area | Path | Status |
|------|------|--------|
| Nx workspace root | `.` | Created |
| NestJS API app | `apps/api` | Created |
| React ERP Admin UI | `apps/web` | Created (Phase 1) |
| Master data lib | `libs/masterdata` | Created (Phase 1) |
| tRPC lib | `libs/trpc` | Created (Phase 1) |
| Data migration lib | `libs/migration` | Created (Phase 2) |
| Finance lib | `libs/finance` | Created (Phase 3) |
| PLM lib | `libs/plm` | Created (Phase 4) |
| Storage lib | `libs/shared/storage` | Created (Phase 4) |
| Documents REST controller | `apps/api/src/app/documents.controller.ts` | Created (Phase 4) |
| PLM UI | `apps/web/src/pages/plm/documents.tsx` | Created (Phase 4) |
| WMS lib | `libs/wms` | Created (Phase 5) |
| WMS UI | `apps/web/src/pages/wms/*` | Created (Phase 5) |
| Migration CLI | `scripts/migrate.ts` | Created (Phase 2) |
| Legacy sample data | `data/legacy-samples/` | Created (Phase 2) |
| Migration docs | `docs/migration-*.md` | Created (Phase 2) |
| Shared config lib | `libs/shared/config` | Created |
| Shared database lib | `libs/shared/database` | Created |
| Shared event-bus lib | `libs/shared/event-bus` | Created |
| Shared audit lib | `libs/shared/audit` | Created |
| Shared health lib | `libs/shared/health` | Created |
| Shared auth lib | `libs/shared/auth` | Created |
| Docker Compose | `docker-compose.yml` | Created |
| Dockerfile | `Dockerfile` | Created |
| Prisma schema | `libs/shared/database/prisma/schema.prisma` | Extended (master data, migration staging, finance, PLM, WMS) |
| CI pipeline | `.github/workflows/ci.yml` | Created |
| Root README (local dev) | `README.md` | Updated |
| Env files | `.env.example` | Created |
| Backup scripts | `scripts/backup.sh`, `scripts/restore.sh` | Created |
| Backup runbook | `docs/backup-restore-runbook.md` | Created |
| Field deployment SOP | `docs/field-deployment-sop.md` | Created |
| Agent memory (this file) | `.brain/MEMORY.md` | Active |
| Session log | `.brain/SESSION.md` | Active |

---

## Locked Architectural Decisions

| Decision | Choice | Phase | Notes |
|----------|--------|-------|-------|
| Redis Event Bus transport | **Redis Streams** | 0 | Durable, replayable; stream key `anc:event-bus` |
| Authentication strategy | **JWT** (access + refresh) | 0 | Refresh tokens hashed in DB; `jti` on refresh tokens (Phase 1 fix) |
| Deploy target | **Self-hosted / on-prem Docker** | 0 | Tagged-release deploy in CI |
| Secrets sourcing | `.env` local / GitHub Secrets CI / host env prod | 0 | Vault documented as future step |
| Backup RTO/RPO targets | **RPO ≤ 24h, RTO ≤ 4h** | 0 | Nightly encrypted pg_dump; confirm with ops |
| Prisma version | **6.x** | 0 | Prisma 7 deferred (breaking config changes) |
| API layer split | **REST auth + tRPC domain** | 1 | `POST /api/auth/login` for tokens; tRPC at `/trpc` for master data |
| tRPC mounting | **Express middleware in `main.ts`** | 1 | JWT from `Authorization` header via `createContextFromRequest` |
| Master data soft-delete | **`active` + `deletedAt`** | 1 | No hard deletes on Product/Customer/Vendor |
| Read-only role | **Viewer** | 1 | Seeded for role-gating tests; extends RBAC baseline |
| Migration tooling form | **CLI + Nx lib**, not UI | 2 | `scripts/migrate.ts` over `libs/migration`; idempotent, audit-trailed |
| Migration idempotency key | **`(sourceSystem, sourceId)`** | 2 | Staging upsert; promoted rows preserved on re-ingest |
| Staging-first loading | **`MigrationBatch` + `Staging*` tables** | 2 | Promote is a separate, reviewed step; never load straight to prod |
| Quotes/inventory at migration | **Staged, not promoted** | 2 | No prod Quote model (Phase 6 CPQ) / inventory model (Phase 5 WMS) yet |
| Finance as source of truth | **Services-only writes to ledger** | 3 | Other modules emit events; no direct ledger table writes |
| Money storage | **Decimal(18,2) in DB; number in API** | 3 | tRPC JSON responses use plain numbers |
| Posted journal immutability | **Reversing entries only** | 3 | `JournalService.reverse()` mirrors debits/credits |
| Default COA codes | **1000–5000** | 3 | Cash, AR, AP, Equity, Revenue, Expense for auto-posting |
| Binary file transport | **REST multipart + stream** | 4 | Upload/download via DocumentsController; metadata via tRPC |
| Object key scheme | **`documents/{documentId}/{revisionId}-{filename}`** | 4 | Uploads never overwrite; each revision gets a new key |
| Document revision immutability | **Never delete revisions** | 4 | New upload = new DocumentRevision row + new MinIO object |
| Single released revision | **Auto-obsolete prior Released** | 4 | Enforced in `DocumentService.transitionStatus` |
| Inventory source of truth | **Services-only writes to InventoryQuantity** | 5 | Movements append-only in InventoryMovement |
| Available quantity | **onHand - allocated (computed, not stored)** | 5 | Enforced in `InventoryService`; pick guards available |
| Negative inventory | **Explicit allowNegative override only** | 5 | Default rejects negative onHand/available |

---

## Cross-Phase Conventions

Follow these on every phase unless a specific phase prompt overrides them.

### Tech Stack

- **Backend:** Node.js with NestJS, structured as a Modular Monolith (one Nx app, separate Nx libraries per domain module)
- **Database:** PostgreSQL is the system of record, accessed via Prisma
- **Cache / real-time:** Redis, used for both caching and the Event Bus (**Redis Streams**)
- **Object storage:** MinIO, S3-compatible, for files/documents/photos
- **API layer:** tRPC for domain data; REST retained for auth token issuance (Phase 1+)
- **Frontend:** React (`apps/web`), Shadcn-style components and Tailwind
- **Monorepo tooling:** Nx, TypeScript strict mode throughout

### Build Sequence (per phase)

```
Schema → Service → API → Tests → UI → Integration
```

Do not start UI work until the service layer has passing tests.

### Event Bus Conventions

- **Transport:** Redis Streams on key `anc:event-bus`
- **Topic naming:** `domain.entity.action`, all lowercase
- **Payload fields:** `entityId`, `orgId`, `actorId`, `timestamp`, `version`, `payload`
- **Documentation:** Each module documents emitted topics in an `EVENTS.md` file inside its Nx library

### RBAC Baseline

- **Phase 0 roles:** Admin, Manager (seeded in `prisma/seed.ts`)
- **Phase 1 role:** Viewer (read-only; authenticated reads, no writes)
- **Write gating:** Admin and Manager for master data mutations (tRPC `editorProcedure`)
- **Extension rule:** New personas extend the role table — do not create parallel permission systems

### Testing

- Every service needs unit tests for business logic and integration tests for tRPC endpoints against a test database
- Do not mark a phase complete until tests pass in CI, not just locally
- `SKIP_MASTERDATA_EVENT_LOG=true` in API Jest setup to avoid Redis subscriber hangs in tests

### Documentation

- Every Nx library gets a short README describing its purpose, Prisma models, tRPC routes, and events it emits/consumes

### Scope Discipline

- Build only what the current phase's prompt specifies
- Dependencies on future phases: stub clearly (e.g. TODO with phase number) rather than building ahead
- Unspecified business rules: implement a reasonable default, flag as placeholder in the README, and ask before treating as final

---

## Phase Roadmap (Index)

Full prompts and Definition-of-Done checklists: [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)

| Phase | Module / Deliverable | Status |
|-------|---------------------|--------|
| 0 | Infrastructure — Nx, Docker, auth, Event Bus, audit, health, CI/CD | **Complete** |
| 0.5 | White-glove physical SOP (documentation only) | **Complete** |
| 1 | ERP Core — master data (Product, Customer, Vendor) | **Complete** |
| 2 | Data migration & legacy cutover | **Complete** |
| 3 | Finance & accounting | **Complete** |
| 4 | PLM & documents | **Complete** |
| 5 | WMS — inventory | **Complete** |
| 6 | CRM & CPQ — sales | Not started |
| 7 | Sales order management & fulfillment | Not started |
| 8 | MPS — production scheduling | Not started |
| 9 | MRP — material planning | Not started |
| 10 | Procurement & vendor integration | Not started |
| 11 | Workforce management (time & scheduling) | Not started |
| 12 | MES — production execution | Not started |
| 13 | QMS — quality management | Not started |
| 14 | CMMS — maintenance management | Not started |
| 15 | Returns & RMA management | Not started |
| 16 | Analytics & AI | Not started |
| 17 | Training, UAT & change management | Not started |

---

## Events Registry (Living)

Cross-module event topics registered as phases complete. Module-specific details live in each library's `EVENTS.md`.

| Topic | Module | Phase | Payload summary |
|-------|--------|-------|-----------------|
| `masterdata.product.created` | masterdata | 1 | `{ sku, description }` |
| `masterdata.product.updated` | masterdata | 1 | `{ sku }` |
| `masterdata.product.deactivated` | masterdata | 1 | `{ sku }` |
| `masterdata.customer.created` | masterdata | 1 | `{ name }` |
| `masterdata.customer.updated` | masterdata | 1 | `{ name }` |
| `masterdata.customer.deactivated` | masterdata | 1 | `{ name }` |
| `masterdata.vendor.created` | masterdata | 1 | `{ name }` |
| `masterdata.vendor.updated` | masterdata | 1 | `{ name }` |
| `masterdata.vendor.deactivated` | masterdata | 1 | `{ name }` |
| `finance.journal.posted` | finance | 3 | `{ entryNumber, total }` |
| `finance.journal.reversed` | finance | 3 | `{ entryNumber, reversedEntryId }` |
| `finance.invoice.created` | finance | 3 | `{ invoiceNumber, customerId, total }` |
| `finance.invoice.posted` | finance | 3 | `{ invoiceNumber, total }` |
| `finance.invoice.paid` | finance | 3 | `{ invoiceNumber, totalPaid }` |
| `finance.invoice.voided` | finance | 3 | `{ invoiceNumber }` |
| `finance.bill.created` | finance | 3 | `{ billNumber, vendorId, total }` |
| `finance.bill.posted` | finance | 3 | `{ billNumber, total }` |
| `finance.bill.paid` | finance | 3 | `{ billNumber, totalPaid }` |
| `finance.bill.voided` | finance | 3 | `{ billNumber }` |
| `finance.payment.recorded` | finance | 3 | `{ type, amount }` |
| `plm.document.uploaded` | plm | 4 | `{ documentId, revisionId, revisionNumber, fileName, productId }` |
| `plm.document.revised` | plm | 4 | `{ documentId, revisionId, revisionNumber, fileName, productId }` |
| `plm.document.released` | plm | 4 | `{ documentId, revisionId, revisionNumber, productId }` |
| `wms.inventory.received` | wms | 5 | `{ productId, binId, quantity, sku, binCode }` |
| `wms.inventory.moved` | wms | 5 | `{ productId, fromBinId?, toBinId?, binId?, quantity }` |
| `wms.inventory.shipped` | wms | 5 | `{ productId, binId, quantity }` |
| `wms.inventory.adjusted` | wms | 5 | `{ productId, binId, quantityDelta, reasonCode }` |

---

## Memory Maintenance Rules

### Update this file when

- A phase completes — update **Current Phase**, check off DoD items, set phase status in **Phase Roadmap**
- An architectural choice is made — record in **Locked Architectural Decisions**
- New apps, libraries, or infra paths are created — fill in **Repository Map**
- New RBAC roles are added — note under **Cross-Phase Conventions → RBAC Baseline**
- New event topics are emitted — add rows to **Events Registry** and ensure module `EVENTS.md` exists

### Do not store here

- Secrets, credentials, or `.env` values
- Full phase prompt text (link to build prompts file instead)
- Transient debug notes or session-specific chatter (use `SESSION.md`)
- Large code snippets — link to files in the repo instead

### Workflow

1. Read `.brain/MEMORY.md` and `.brain/SESSION.md` at session start
2. Read the active phase prompt from [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md) when implementing work
3. Implement following **Cross-Phase Conventions**
4. Update `SESSION.md` every 3–5 turns or when finishing a task
5. Update this file before ending the session if anything architectural or structural changed
