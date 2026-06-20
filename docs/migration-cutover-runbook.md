# Cutover Runbook — Legacy → AnC Business Suite (Phase 2)

This runbook covers migrating Master Data (Customers, Vendors, Products; open
Quotes and inventory balances staged for later phases) from the legacy system
into AnC Business Suite and re-pointing operations to the new system.

> Audience: operations + a database operator. The ETL is CLI tooling
> (`scripts/migrate.ts`); no end-user UI is required for cutover.

## 0. Roles & prerequisites

- **Migration operator** — runs the ETL CLI, reviews reconciliation reports.
- **DBA** — takes/verifies backups, performs restores if rollback is needed.
- **Business owner** — signs off on the reconciliation report before promote.
- Prerequisites: `DATABASE_URL` pointing at the target DB, Docker services up
  (`npm run docker:up`), Prisma migrations applied
  (`npm run prisma:migrate:deploy`), legacy export files mapped to the
  [expected schema](./migration-expected-schema.md).

## 1. Parallel-run period (recommended: 1–2 weeks)

- Keep the legacy system as the **system of record**. The new system runs
  read-mostly alongside it.
- Run a **trial migration** into staging against a copy of production:
  ```bash
  npm run migrate:run -- --source legacy-erp --dir data/legacy-export
  ```
- Review `migration-output/reconciliation-<batchId>.json` and the console
  report. Confirm `extracted` vs `staged` differences (collapsed duplicates) and
  all flagged conflicts are understood.
- Have the business owner correct conflicts **in the legacy export**, re-run
  ingest with the same `--batch <id>` to refresh staging, and re-reconcile.
- Exit criteria: reconciliation report shows expected counts and **zero
  unexplained conflicts**.

## 2. Go-live sequencing (cutover window)

Pick a low-activity window. Announce a freeze on legacy writes.

1. **Freeze legacy writes.** No new customers/vendors/products/quotes in legacy.
2. **DBA: full backup of the target DB.** `npm run backup` (records the
   pre-cutover restore point). Note the timestamp/snapshot id.
3. **Produce the final legacy export** (post-freeze) and place it in the export
   directory.
4. **Ingest the final batch:**
   ```bash
   npm run migrate:ingest -- --source legacy-erp --dir data/legacy-export
   ```
   Record the printed `batchId`.
5. **Reconcile and get sign-off:**
   ```bash
   npm run migrate:reconcile -- --batch <batchId>
   ```
   Business owner reviews and approves. Do not proceed with unresolved
   conflicts.
6. **Promote to production:**
   ```bash
   npm run migrate:promote -- --batch <batchId>
   ```
   Conflicted records are skipped automatically; only VALID records are written.
7. **Verify** record counts in the app (Customers/Vendors/Products lists) match
   the reconciliation `promoted` totals. Spot-check 5–10 records against legacy.

## 3. What gets re-pointed at cutover

| Concern | Before | After cutover |
|---|---|---|
| Master Data system of record | Legacy | **AnC Business Suite** |
| New customer/vendor/product creation | Legacy | **AnC Business Suite** (Admin/Manager via tRPC UI) |
| Open quotes | Legacy | Staged in AnC; promoted when Phase 6 (CPQ) ships |
| Inventory balances | Legacy | Staged in AnC; promoted when Phase 5 (WMS) ships |
| Reporting/integrations reading master data | Legacy DB | AnC API (`/api`, `/trpc`) |

8. **Lift the freeze** on the new system. Direct all master-data writes to AnC.
9. **Decommission legacy writes** (keep legacy read-only as an archive for the
   agreed retention period).

## 4. Post-cutover validation

- Confirm audit trail: `AuditLog` rows with `action LIKE 'migration.promote%'`
  equal the promoted counts.
- Confirm batch status is `PROMOTED`
  (`SELECT id, status FROM "MigrationBatch"`).
- Keep `migration-output/reconciliation-<batchId>.json` with the cutover record.

## 5. If validation fails

Go to the [rollback procedure](./migration-rollback-procedure.md). Decide
between a **logical rollback** (undo this batch) and a **full restore** (revert
the DB to the pre-cutover backup) based on how much new activity has occurred.

## 6. Dry-run checklist (must be done at least once before go-live)

- [ ] ETL runs end-to-end against a staging copy with no manual intervention.
- [ ] Reconciliation report reviewed and counts/conflicts validated.
- [ ] `promote` then `rollback` exercised on the staging copy; production tables
      return to their pre-promote state.
- [ ] Backup + restore path verified by the DBA.
