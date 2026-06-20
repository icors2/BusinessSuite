# Analytics (Phase 16)

Event ingestion, natural-language querying, bottleneck detection, and inventory forecasting.

## Prisma models

- `AnalyticsEvent` — deduplicated event store (`dedupeKey = topic:entityId:timestamp`)
- `InventoryForecast` — batch-computed per-product demand/depletion/reorder projections

## tRPC (`analytics`)

| Procedure | RBAC | Description |
|-----------|------|-------------|
| `ask` | Authenticated | Deterministic NLQ over analytics data |
| `getEventVolume` | Authenticated | Event counts by topic/day |
| `getScrapRate` | Authenticated | MES cycle scrap rate |
| `getBottlenecks` | Authenticated | WIP pileup by workstation |
| `getForecasts` | Authenticated | Latest inventory forecasts |
| `getIngestionStatus` | Authenticated | Topic coverage vs registry |
| `recomputeForecasts` | Editor+ | Batch recompute forecasts |

## Events

**Consumes:** all Phase 1–15 topics (see `ALL_INGESTED_TOPICS` in `ingested-topics.ts`)

**Emits:** `analytics.forecast.computed`

## Data freshness

- **Real-time:** event ingestion via `AnalyticsIngestionSubscriber` (consumer group `analytics-ingest`)
- **Near-real-time:** scrap rate and bottlenecks (queried from operational tables)
- **Batch:** inventory forecasts (recompute via tRPC)

## NLQ

Curated deterministic intent parser — no external LLM. Unrecognized questions return supported examples.

## MRP linkage

Forecast reorder dates are advisory; full auto-consumption by MRP is a documented stub.
