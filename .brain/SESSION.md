# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Phase 9 — MRP (Material Planning) **complete**.

---

## Active Task

_None — ready for Phase 10 (Procurement & Vendor Integration)._

---

## Recent Progress

- Prisma MRP schema: BillOfMaterials, BomLine, PurchaseRequisition; migration `20260620115456_add_mrp`
- Created `libs/mrp` — MrpService, explosion/net-demand/requisitions helpers, EVENTS.md
- tRPC `mrp` router; MrpModule wired (WmsModule for inventory lookup)
- Procurement UI: `/mrp/procurement` (run MRP, requirements table, requisition approve/reject/adjust)
- Seed: SKU-001 MAKE, 2-level BOM (SKU-SUB-001 → SKU-002 BUY), SKU-FAST-001 BUY with vendor lead times
- 5 mrp unit tests + 6 mrp integration tests; full suite green (16 projects)
- Updated MEMORY.md, README.md, build prompts doc (Phase 9 ✅ COMPLETE)

---

## Next Steps

1. Start **Phase 10 — Procurement & Vendor Integration** using [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)

---

## Session Notes

- MRP explodes open work orders (non-CANCELLED/non-COMPLETED) through multi-level BOMs
- MAKE products recurse; BUY leaf components generate requisitions
- Need-by = WO scheduledStart − component leadTimeDays (Vendor.leadTimeDays fallback)
- Requisitions idempotent on `(componentProductId, needByDate)` — re-run updates qty, no duplicates
- Open PO netting stubbed as zero (`// Phase 10`)
