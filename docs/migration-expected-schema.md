# Migration — Expected Input Schema (Phase 2)

The legacy system's native export format is not fixed. Map the legacy export to
the field names below and save as **CSV** (header row required) or **JSON**
(array of objects). All values are read as strings and validated/coerced during
the transform step; anything that fails validation is flagged as a conflict and
written to the reconciliation report rather than dropped.

File auto-detection (when using `--dir`): `customers.(csv|json)`,
`vendors.(csv|json)`, `products.(csv|json)`, `quotes.(csv|json)`.

`sourceId` is **required on every row** for all entities — it is the legacy
primary key and is used as the idempotency key `(sourceSystem, sourceId)`.

## Customers → `Customer`

| Field | Required | Maps to | Notes |
|---|---|---|---|
| `sourceId` | yes | (staging key) | legacy customer id |
| `name` | yes | `name` | conflict if blank |
| `email` | no | `email` | |
| `phone` | no | `phone` | |
| `billingLine1` | no | `billingAddress.line1` | |
| `billingCity` | no | `billingAddress.city` | |
| `billingState` | no | `billingAddress.state` | |
| `billingPostalCode` | no | `billingAddress.postalCode` | |
| `billingCountry` | no | `billingAddress.country` | defaults to `US` |
| `shippingLine1`/`shippingCity`/`shippingState`/`shippingPostalCode`/`shippingCountry` | no | `shippingAddress.*` | |
| `creditTerms` | no | `creditTerms` | e.g. `Net 30` |

## Vendors → `Vendor`

| Field | Required | Maps to | Notes |
|---|---|---|---|
| `sourceId` | yes | (staging key) | |
| `name` | yes | `name` | conflict if blank |
| `email` | no | `email` | |
| `phone` | no | `phone` | |
| `addressLine1`/`addressCity`/`addressState`/`addressPostalCode`/`addressCountry` | no | `address.*` | country defaults to `US` |
| `paymentTerms` | no | `paymentTerms` | |

## Products → `Product`

| Field | Required | Maps to | Notes |
|---|---|---|---|
| `sourceId` | yes | (staging key) | |
| `sku` | yes | `sku` | unique in production; promote upserts by SKU |
| `description` | yes | `description` | |
| `unitOfMeasure` | yes | `unitOfMeasure` | e.g. `EA`, `BOX` |
| `category` | no | `category` | |
| `inventoryOnHand` | no | (staged only) | **held for Phase 5 (WMS)** — no production inventory model yet; accepts `1,250` / `$1,250` formats |

## Quotes → staging only (held for Phase 6 CPQ)

There is no production `Quote` model until Phase 6. Open quotes are extracted,
validated, and staged so they're ready to promote when CPQ lands.

| Field | Required | Maps to | Notes |
|---|---|---|---|
| `sourceId` | yes | (staging key) | |
| `customerSourceId` | yes | `customerSourceId` | legacy customer id this quote belongs to |
| `quoteNumber` | yes | `quoteNumber` | |
| `status` | no | `status_legacy` | legacy status string |
| `totalAmount` | no | `totalAmount` | numeric |
| `currency` | no | `currency` | e.g. `USD` |
| `quotedAt` | no | `quotedAt` | any parseable date |
| `lineItems` | no | `lineItems` | JSON string; conflict if not valid JSON |

## Conflict rules

A record is flagged `CONFLICT` (and excluded from promotion) when:

- `sourceId` is missing/blank.
- A required field for the entity is missing/blank.
- The same `sourceId` appears more than once in the batch (duplicate).
- `quotes.lineItems` is present but not valid JSON.

Conflicts never block the rest of the batch — valid records still load and can be
promoted; conflicts are listed in the reconciliation report for an operator to
correct in the source export and re-run.
