# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-19

---

## Current Focus

Phase 1 — ERP Core (Master Data) **complete**.

---

## Active Task

_None — ready for Phase 2._

---

## Recent Progress

- Added Prisma models: Product, Customer, Vendor (soft-delete via `active` + `deletedAt`)
- Migration `20260620041302_add_master_data`; seed extended with Viewer role + sample records
- Created `libs/masterdata` — services, validation, audit, event emission, log subscriber
- Created `libs/trpc` — JWT context, procedures, composed `AppRouter`, masterdata routers
- Mounted tRPC at `/trpc` in `apps/api/src/main.ts`; REST auth unchanged
- Unit tests (SKU uniqueness, duplicate customer) + integration tests (CRUD, role gating) passing
- Scaffolded `apps/web` — React/Vite/Tailwind ERP Admin UI with list/search/create/edit/deactivate
- Updated MEMORY.md, README.md, build prompts doc (Phase 1 ✅ COMPLETE)

---

## Next Steps

1. Start **Phase 2 — Data Migration & Legacy Cutover** using [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)
2. Site provisioning API still deferred (field SOP Section 4)

---

## Open Items / Blockers

- Site provisioning API deferred to Phase 1+ (documented in field SOP and MEMORY.md)
- `npm run prisma:seed` script JSON quoting may fail on PowerShell — use `npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' libs/shared/database/prisma/seed.ts`

---

## Session Notes

- EventBusModule marked `global: true` so masterdata services can inject `EVENT_BUS`
- Refresh tokens now include `jti` to prevent hash collisions on rapid login
- MasterdataLogSubscriber skipped in test env (`SKIP_MASTERDATA_EVENT_LOG`)
