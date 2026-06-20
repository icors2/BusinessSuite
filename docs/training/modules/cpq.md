# CPQ — Configure, Price, Quote

## Purpose

FabQuote-derived costing for fabricated lines, rule-based product pricing, quote lifecycle (Draft → Sent → Accepted/Rejected/Expired).

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Create/edit quotes, send, accept |
| Admin only | Catalog rate cards and pricing config |
| Viewer | Read quotes |

## UI routes

| Route | Description |
|-------|-------------|
| `/cpq/quotes` | Quote list |
| `/cpq/quotes/:id` | Quote editor |
| `/cpq/catalog` | Product catalog with tier/volume pricing |

## Key tasks

1. Create a quote for a seeded customer.
2. Add product lines (`SKU-001`) and/or fabricated plate/tube lines.
3. **Recalc** to refresh line totals.
4. **Send** the quote (Draft → Sent).
5. **Accept** to enable sales order conversion.
6. Use **Catalog** to preview tier/volume pricing.

## Permissions

- Quote writes: **Admin** or **Manager**.
- Catalog config updates: **Admin** only.

## tRPC procedures

- `quote`: create, get, list, addProductLine, addFabricatedLine, updateLine, removeLine, recalc, transition, pricePreview
- `cpqCatalog`: searchMaterials, searchParts, searchProducts, getSettings, updateRateCard, updatePricingConfig, updateFormulas

## Related events

`sales.quote.created`, `sales.quote.sent`, `sales.quote.accepted`, `sales.quote.rejected`, `sales.quote.expired`

## Demo login

`manager@arcncode.local` / `Manager123!`
