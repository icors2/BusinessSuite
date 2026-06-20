# Support & Feedback Process

Lightweight convention for reporting issues, feedback, and change requests. Uses existing tools (email, GitHub Issues, or the tickets log below) — no application code required.

## Intake channels

| Channel | Use for |
|---------|---------|
| **GitHub Issues** (`icors2/BusinessSuite`) | Bugs, feature requests, documentation gaps |
| **Email** `support@arcncode.local` (demo) / ops alias (prod) | Urgent production issues, customer escalations |
| **[tickets-log.md](./tickets-log.md)** | Internal running log with triage history |

## Ticket template

Copy this block when opening a ticket:

```
ID:          SUP-YYYY-NNNN
Reporter:    <name / email>
Module:      <e.g. Returns, MES, Finance>
Severity:    P1-Critical | P2-High | P3-Medium | P4-Low
Environment: Demo | Staging | Production
Summary:     <one line>
Steps:       1. … 2. … 3. …
Expected:    <what should happen>
Actual:      <what happened>
Screenshots: <links optional>
```

## Severity definitions

| Level | Definition | Example |
|-------|------------|---------|
| **P1** | Production down or data loss | Cannot ship orders; ledger out of balance |
| **P2** | Major feature broken, workaround difficult | RMA receive fails for all lines |
| **P3** | Partial impact or easy workaround | Analytics forecast stale until recompute |
| **P4** | Cosmetic, docs, enhancement | Typo in placard label |

## Triage rules

1. **Acknowledge** within SLA (see below).
2. Assign **module owner** by prefix:

| Module prefix | Primary owner |
|---------------|---------------|
| ERP Admin, Finance | Finance / Admin lead |
| CPQ, Sales, Returns | Commercial ops |
| WMS, Procurement | Supply chain |
| MPS, MRP | Planning |
| Workforce, MES | Production |
| QMS | Quality |
| CMMS | Maintenance |
| Analytics | Data / IT |
| Platform, auth, infra | Engineering |

3. Reproduce in **Demo** with seeded logins before escalating to engineering.
4. Link related **UAT script** step if regression.

## Escalation path

```
Reporter → Support (L1 triage)
         → Module owner (L2)
         → Engineering lead (L3, P1/P2 only)
         → Release manager (change control / hotfix decision)
```

- **P1:** Page on-call engineering immediately; war room within 30 minutes.
- **P2:** Module owner + engineering same business day.
- **P3/P4:** Backlog prioritization in weekly grooming.

## SLAs

| Severity | First response | Target resolution |
|----------|----------------|-------------------|
| P1 | 15 minutes | 4 hours (mitigation); 24h (fix or rollback plan) |
| P2 | 2 hours | 2 business days |
| P3 | 1 business day | Next sprint |
| P4 | 3 business days | Backlog / quarterly |

## Feedback → change management

1. Validated bug → GitHub Issue + fix PR → UAT re-run on affected module script.
2. Enhancement → Issue labeled `enhancement` → roadmap review.
3. Training gap → update module guide in `docs/training/modules/` + notify in release notes.
4. Post-incident → add row to [tickets-log.md](./tickets-log.md) if not already tracked.

## Related documents

- [Tickets log](./tickets-log.md)
- [UAT master tracker](../uat/uat-master-tracker.md)
- [Training index](../training/README.md)
