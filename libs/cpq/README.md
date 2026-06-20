# CPQ (Configure, Price, Quote)

Sales quoting module ported from the legacy FabQuote fabrication engine.

## Features

- **PRODUCT lines** — rule-based pricing from `Product.listPrice`, customer tier, volume breaks, optional manual override with reason.
- **FABRICATED lines** — plate / tube / weldment / purchased part costing with rate card, editable formulas, and quantity-break customer pricing.
- **Quote lifecycle** — DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED; pricing snapshot frozen on send.
- **Catalog search** — materials, purchased parts, and products with live price preview.

## Library layout

```
libs/cpq/src/lib/
  engine.ts       # FabQuote costing (plate, tube, weldment, purchased)
  formulas.ts     # Editable formula catalog + safe evaluator
  pricing.ts      # Quantity breaks + product rule pricing
  rate-card.ts    # RateCard + PricingConfig defaults
  quote.service.ts
  catalog.service.ts
  events.ts
  schemas.ts
  report.ts
```

See [EVENTS.md](./EVENTS.md) for Redis event topics.
