# Migration Library (Phase 2)

ETL tooling to migrate legacy data into the Phase 1 Master Data schema. Safe to
re-run (idempotent), staging-first, with a clear audit trail.

## Pipeline

```
extract → transform → load (staging) → reconcile (report) → promote (production)
                                                           ↘ rollback (undo)
```

- **extract** (`extract.ts`) — read legacy CSV/JSON into raw rows
- **transform** (`transform.ts`) — map to Phase 1 shapes; flag conflicts (missing required fields, in-batch duplicate `sourceId`)
- **load** (`load.ts`) — upsert into staging tables on `(sourceSystem, sourceId)`; never touches production
- **reconcile** (`reconcile.ts`) — counts in/staged/valid/conflicts/promoted + conflict samples
- **promote** (`promote.ts`) — copy VALID staging rows into `Customer`/`Vendor`/`Product`; products upsert by SKU; quotes & inventory balances held for Phases 6/5
- **rollback** (`rollback.ts`) — delete records this batch created and reset staging to VALID

## Expected input schema

The legacy export is mapped to documented field names (see
`docs/migration-expected-schema.md`). Input is CSV or JSON; all values are read
as strings and validated/coerced during transform.

## CLI

Run via the root npm scripts (see `scripts/migrate.ts`):

```bash
npm run migrate:run -- --source legacy-erp --dir data/legacy-samples
npm run migrate:reconcile -- --batch <id>
npm run migrate:promote -- --batch <id>
npm run migrate:rollback -- --batch <id>
```

## Staging models

`MigrationBatch`, `StagingCustomer`, `StagingVendor`, `StagingProduct`,
`StagingQuote` in `libs/shared/database/prisma/schema.prisma`.

## Cutover & rollback

See `docs/migration-cutover-runbook.md` and `docs/migration-rollback-procedure.md`.
