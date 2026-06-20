# Rollback Procedure — Migration Cutover (Phase 2)

If post-cutover validation fails, revert to the legacy system. There are two
rollback paths; choose based on how much new activity has happened on the new
system since promote.

## Decision guide

| Situation | Use |
|---|---|
| Promote just ran; little/no new business activity in AnC | **Logical rollback** (fast, surgical) |
| Significant new activity, or data corruption suspected | **Full database restore** (clean, authoritative) |

---

## Path A — Logical rollback (undo a single batch)

Deletes exactly the production records this batch created and resets its staging
rows to `VALID` so the batch can be corrected and re-promoted. Tracked via
`staging.promotedId`, so it only removes records owned by this batch.

```bash
npm run migrate:rollback -- --batch <batchId>
```

What it does:
- Deletes the `Customer` / `Vendor` / `Product` rows promoted by this batch.
- Resets matching staging rows from `PROMOTED` → `VALID` (clears `promotedId`).
- Writes an `AuditLog` entry (`action = 'migration.rollback'`).
- Sets the batch status to `ROLLED_BACK`.

**Limits / safe-undo window:**
- Safe only while no other records reference the migrated ones. Products are
  promoted via **SKU upsert** — if a SKU pre-existed before this batch, rollback
  deletes that product row too (it cannot tell a pre-existing SKU from a
  batch-created one once upserted). Prefer Path B if SKUs overlapped with
  pre-existing data.
- Quotes/inventory were only staged (never promoted), so nothing to undo there.
- If downstream phases (Finance, Sales) have already linked to a migrated
  customer/vendor, deletion may fail or orphan references — use Path B.

After a logical rollback: re-point operations back to legacy, correct the source
export, then re-run `ingest` (same `--batch`) → `reconcile` → `promote`.

---

## Path B — Full database restore (authoritative revert)

Restores the entire target DB to the **pre-cutover backup** taken in step 2 of
the cutover runbook.

```bash
npm run restore   # follow prompts; select the pre-cutover snapshot/timestamp
```

- Re-point all operations back to the legacy system (legacy resumes as system of
  record).
- Verify the app reflects pre-cutover state (Master Data counts, no migration
  batch present).
- Root-cause the failure, fix the legacy export, and reschedule cutover.

**How far back can changes be safely undone?**
- To the **pre-cutover backup point** (step 2 of the runbook). Any business
  activity performed in the new system *after* promote and *before* restore will
  be lost on restore — this is why cutover happens in a freeze window and the
  parallel-run keeps legacy authoritative until sign-off.

---

## Verification after rollback

- `SELECT status FROM "MigrationBatch" WHERE id = '<batchId>'` →
  `ROLLED_BACK` (Path A) or batch absent (Path B).
- Master Data list counts in the app match the pre-cutover baseline.
- `AuditLog` contains the rollback entry (Path A).
- Legacy system confirmed back in service as system of record.
