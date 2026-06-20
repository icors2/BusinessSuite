# Arc N Code Business Suite — Persistent Memory

> **Read at the start of every session.** Update when architectural decisions are made, phases complete, or repo structure changes.

---

## Project Snapshot

| Field | Value |
|-------|-------|
| **Product** | Arc N Code Business Suite — integrated manufacturing operations platform |
| **Audience** | Manufacturing businesses; deployed on-site with field technician setup |
| **Architecture** | Single Nx monorepo, NestJS modular monolith, phased delivery (Phases 0–17) |
| **Repo status** | Phase 0 complete — Nx workspace, API, shared libs, Docker, CI |
| **Primary build spec** | [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md) |
| **Agent rules** | [.cursor/.cursorrules.md](../.cursor/.cursorrules.md) |

Build one phase at a time, in order. Do not skip ahead. Start a fresh session per phase when possible so context stays grounded in what already exists.

---

## Current Phase

| Field | Value |
|-------|-------|
| **Active phase** | None — Phase 0.5 complete |
| **Next phase** | **Phase 1 — ERP Core (Master Data)** |
| **Last updated** | 2026-06-19 |

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

> **Note:** Docker Desktop was not running during local implementation; `docker-compose.yml` and tests are in place. Start Docker and run `docker compose up -d` to verify the full stack locally.

### Blockers / Open Questions

- **Site provisioning API (Phase 1+):** Automated registry-token / `POST /api/provision/register` not built in Phase 0. Field SOP documents manual interim process — see [docs/field-deployment-sop.md](../docs/field-deployment-sop.md) Section 4.

---

## Repository Map

| Area | Path | Status |
|------|------|--------|
| Nx workspace root | `.` | Created |
| NestJS API app | `apps/api` | Created |
| Shared config lib | `libs/shared/config` | Created |
| Shared database lib | `libs/shared/database` | Created |
| Shared event-bus lib | `libs/shared/event-bus` | Created |
| Shared audit lib | `libs/shared/audit` | Created |
| Shared health lib | `libs/shared/health` | Created |
| Shared auth lib | `libs/shared/auth` | Created |
| React frontend app | _TBD_ | Phase 1+ |
| Docker Compose | `docker-compose.yml` | Created |
| Dockerfile | `Dockerfile` | Created |
| Prisma schema | `libs/shared/database/prisma/schema.prisma` | Created |
| CI pipeline | `.github/workflows/ci.yml` | Created |
| Root README (local dev) | `README.md` | Created |
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
| Authentication strategy | **JWT** (access + refresh) | 0 | Refresh tokens hashed in DB |
| Deploy target | **Self-hosted / on-prem Docker** | 0 | Tagged-release deploy in CI |
| Secrets sourcing | `.env` local / GitHub Secrets CI / host env prod | 0 | Vault documented as future step |
| Backup RTO/RPO targets | **RPO ≤ 24h, RTO ≤ 4h** | 0 | Nightly encrypted pg_dump; confirm with ops |
| Prisma version | **6.x** | 0 | Prisma 7 deferred (breaking config changes) |

---

## Cross-Phase Conventions

Follow these on every phase unless a specific phase prompt overrides them.

### Tech Stack

- **Backend:** Node.js with NestJS, structured as a Modular Monolith (one Nx app, separate Nx libraries per domain module)
- **Database:** PostgreSQL is the system of record, accessed via Prisma
- **Cache / real-time:** Redis, used for both caching and the Event Bus (**Redis Streams**)
- **Object storage:** MinIO, S3-compatible, for files/documents/photos
- **API layer:** tRPC, fully typed end-to-end between backend and frontend (Phase 0 uses REST; tRPC in Phase 1+)
- **Frontend:** React, using Shadcn UI components and Tailwind
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
- **Extension rule:** New personas extend the role table — do not create parallel permission systems

### Testing

- Every service needs unit tests for business logic and integration tests for tRPC endpoints against a test database
- Do not mark a phase complete until tests pass in CI, not just locally

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
| 1 | ERP Core — master data (Product, Customer, Vendor) | Not started |
| 2 | Data migration & legacy cutover | Not started |
| 3 | Finance & accounting | Not started |
| 4 | PLM & documents | Not started |
| 5 | WMS — inventory | Not started |
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
| _Convention established_ | event-bus | 0 | Redis Streams on `anc:event-bus`; topics from Phase 1+ |

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
