# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Phase 2 — Data Migration & Legacy Cutover **complete**.

---

## Active Task

_None — ready for Phase 3 (Finance & Accounting Core)._

---

## Recent Progress

- Added Prisma staging schema: `MigrationBatch` + `StagingCustomer/Vendor/Product/Quote` with status enums; migration `20260620042705_add_migration_staging`
- Created `libs/migration` — extract (CSV/JSON), transform + conflict detection, load (staging upsert), reconcile (report), promote (staging→prod), rollback, runner orchestrator
- Dependency-free RFC-4180-style CSV parser (quoted fields, escaped quotes, embedded newlines)
- Built `scripts/migrate.ts` CLI (`run`/`ingest`/`reconcile`/`promote`/`rollback`) + npm scripts; report artifacts to `migration-output/` (gitignored)
- Sample legacy data in `data/legacy-samples/` (deliberate conflicts: missing fields, duplicate sourceId)
- 18 tests passing: unit (transform/conflict/CSV) + integration ETL (ingest→reconcile→promote→idempotency→rollback) against Docker DB
- Dry-ran full CLI against samples (promote +2 cust/+2 vend/+3 prod, 2 quotes held; rollback clean); cleaned dry-run data
- Docs: `docs/migration-expected-schema.md`, `docs/migration-cutover-runbook.md`, `docs/migration-rollback-procedure.md`
- Updated MEMORY.md, README.md, build prompts doc (Phase 2 ✅ COMPLETE)

---

## Next Steps

1. Start **Phase 3 — Finance & Accounting Core** using [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)
2. Site provisioning API still deferred (field SOP Section 4)

---

## Open Items / Blockers

- Site provisioning API deferred to Phase 1+ (documented in field SOP and MEMORY.md)
- `npm run prisma:seed` script JSON quoting may fail on PowerShell — use `npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' libs/shared/database/prisma/seed.ts`
- Quotes + inventory balances are staged but NOT promoted — pick up when Phase 6 (CPQ) / Phase 5 (WMS) land

---

## Session Notes

- Migration idempotency: load skips re-writing rows already `PROMOTED`; products promote via SKU upsert
- Logical rollback deletes only batch-created rows (via `staging.promotedId`); full restore path documented for overlapping SKUs / heavy post-cutover activity
- Windows: Prisma `generate` can EPERM-lock if stale `node` processes hold the engine DLL — stop them and retry
- PowerShell has no heredoc; use `prisma db execute --file` for ad-hoc SQL
