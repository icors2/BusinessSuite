# Analytics Events

## Consumed (ingestion)

All topics in `ALL_INGESTED_TOPICS` (`src/lib/ingested-topics.ts`) — Phases 1–15 event registry.

Consumer group: `analytics-ingest`

## Emitted

| Topic | When | Payload |
|-------|------|---------|
| `analytics.forecast.computed` | After `computeInventoryForecasts` | `{ count, asOfDate }` |
