# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Phase 8 — MPS (Production Scheduling) **complete**.

---

## Active Task

_None — ready for Phase 9 (MRP — Material Planning)._

---

## Recent Progress

- Prisma MPS schema: ProductionLine, FactoryCalendarDay, WorkOrder, MpsSetting; migration `20260620113538_add_mps`
- Created `libs/mps` — MpsService, aggregation/net-demand/scheduling helpers, SalesDemandSubscriber, EVENTS.md
- tRPC `mps` router; MpsModule wired (WmsModule)
- MPS UI: dashboard (demand preview, work order timeline, overload warnings, reschedule)
- Seed: LINE-MAIN, 30-day calendar, sample work order from SO-SEED-001 demand
- 9 mps unit tests + 6 mps integration tests; full suite green (15 projects)
- Updated MEMORY.md, README.md, build prompts doc (Phase 8 ✅ COMPLETE)

---

## Next Steps

1. Start **Phase 9 — MRP (Material Planning)** using [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)

---

## Session Notes

- MPS demand = all open product-linked sales lines; net demand nets WMS available + scheduled WOs
- Aggregation strategies: WEEKLY, MONTHLY, BUILD_TO_ORDER (per product → category → GLOBAL)
- Overload flagged via `mps.capacity.overloaded` event, not silently absorbed
- SalesDemandSubscriber disabled in tests via SKIP_MPS_SUBSCRIBER=true
