# Analytics & AI

## Purpose

Event ingestion from operational modules, natural-language Q&A, scrap rate and event volume dashboards, MES bottleneck detection, and inventory demand forecasting.

## Who uses it

| Role | Access |
|------|--------|
| All authenticated | Dashboard, ask, read bottlenecks/forecasts |
| Admin, Manager | Recompute forecasts |

## UI routes

| Route | Description |
|-------|-------------|
| `/analytics/dashboard` | Event volume, scrap rate, ingestion status |
| `/analytics/ask` | Natural-language Q&A |
| `/analytics/bottlenecks` | WIP pileup by workstation |
| `/analytics/forecast` | Inventory depletion projections |

## Key tasks

1. **Dashboard** — confirm ingestion status shows events from seeded modules.
2. **Ask** — e.g. "scrap rate last month" or "event volume this week".
3. **Bottlenecks** — review WIP pileup; seeded data may show `WS-LASER`.
4. **Forecast** — view depletion/reorder projections; **Recompute** refreshes batch forecasts.

## Permissions

- `recomputeForecasts`: **Admin** or **Manager**.
- Reads: all authenticated users.

## tRPC procedures

- `analytics`: ask, getEventVolume, getScrapRate, getBottlenecks, getForecasts, getIngestionStatus, recomputeForecasts

## Related events

Ingests 63 topics via `AnalyticsIngestionSubscriber` (group `analytics-ingest`).

## Demo login

`manager@arcncode.local` / `Manager123!`
