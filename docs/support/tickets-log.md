# Support Tickets Log

Running log of support tickets. See [support-feedback-process.md](./support-feedback-process.md) for intake, triage, and SLAs.

---

## SUP-2026-0001 — RMA receive fails with "bin not found" (WORKED EXAMPLE)

| Field | Value |
|-------|-------|
| **ID** | SUP-2026-0001 |
| **Reporter** | Jordan Lee (Support) |
| **Module** | Returns / WMS |
| **Severity** | P2-High |
| **Environment** | Demo |
| **Status** | **Closed** |
| **Opened** | 2026-06-18 09:12 UTC |
| **Closed** | 2026-06-18 14:45 UTC |

### Summary

Support user cannot receive approved RMA — error references missing returns bin.

### Steps to reproduce

1. Sign in as `support@arcncode.local`.
2. Approve RMA on `SO-SEED-001` line (UAT Returns step 3–4).
3. Click **Receive** with default bin.

### Expected

Stock received into bin `RET-01` in location `RETURNS`; RMA status RECEIVED.

### Actual

API error: returns location/bin not configured in test database (fresh migrate without seed).

### Timeline

| When | Who | Action |
|------|-----|--------|
| 09:12 | Jordan Lee | Ticket opened via email; logged here |
| 09:28 | Alex Chen (L1 Support) | Acknowledged (P2 SLA: 2h) — assigned Supply Chain |
| 09:45 | Alex Chen | Reproduced on clean DB — confirmed missing seed |
| 10:15 | Morgan Patel (Module owner) | Verified seed.ts creates `RETURNS` / `RET-01`; documented in Returns module guide |
| 11:00 | Engineering | No code defect — runbook gap: post-migrate must run `npm run db:seed` |
| 13:30 | Jordan Lee | Re-ran seed on demo; receive succeeded |
| 14:00 | Jordan Lee | Completed [Returns UAT](../uat/uat-returns.md) steps 5–7 — Pass |
| 14:45 | Alex Chen | Closed — resolution: operational; updated [field-deployment-sop.md](../field-deployment-sop.md) note to always seed after migrate |

### Resolution

**Operational / documentation.** Returns bin is seeded data, not auto-created. Added reminder to deployment SOP. No application code change required.

### UAT linkage

- [uat-returns.md](../uat/uat-returns.md) steps 5–7 re-validated **Pass** on 2026-06-18.

---

## Open tickets

_None._

## Closed tickets (index)

| ID | Module | Severity | Closed | Summary |
|----|--------|----------|--------|---------|
| SUP-2026-0001 | Returns | P2 | 2026-06-18 | RMA receive — missing seed bin |
