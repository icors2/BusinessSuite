# Session Log

> Ephemeral working context. Update every 3–5 chat turns or when finishing a task. Do not store secrets here.

---

## Last Updated

2026-06-20

---

## Current Focus

Phase 7 — Sales Order Management & Fulfillment **complete**.

---

## Active Task

_None — ready for Phase 8 (MPS — Production Scheduling)._

---

## Recent Progress

- Prisma sales schema: SalesOrder, SalesOrderLine, SalesOrderShipment; migration `20260620111524_add_sales_orders`
- Created `libs/sales` — SalesOrderService, QuoteAcceptedSubscriber, greedy allocation helper, EVENTS.md
- tRPC `salesOrder` router; SalesModule wired (WmsModule + FinanceModule)
- Sales UI: orders list, order detail (allocate/ship/cancel), Convert-to-Order on accepted quotes
- Seed: SO-SEED-001 with allocated PRODUCT + MTO FABRICATED line
- 12 sales unit tests + 5 sales integration tests; full suite green (14 projects)
- Updated MEMORY.md, README.md, build prompts doc (Phase 7 ✅ COMPLETE)

---

## Next Steps

1. Start **Phase 8 — MPS (Production Scheduling)** using [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md)

---

## Session Notes

- FABRICATED lines skip WMS allocation (`toProduce=true`); shippable manually
- confirmShipment calls InvoiceService.create + post for shipped qty only
- QuoteAcceptedSubscriber disabled in tests via SKIP_SALES_SUBSCRIBER=true
- Re-allocation via salesOrder.allocate when backordered stock arrives
