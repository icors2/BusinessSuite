# Procurement — Purchase Orders & Vendor Integration

Phase 10 module. Converts approved requisitions into purchase orders (consolidated by vendor), supports staff-on-behalf vendor acknowledgment/ASN intake, receive-against-PO with WMS reconciliation, and vendor scorecards.

## Services

- **ProcurementService** — PO lifecycle, ASN intake, receiving, scorecard queries.

## Pure helpers

- `consolidation.ts` — group approved requisitions by vendor
- `scorecard.ts` — on-time delivery and quantity-accuracy rates
- `numbering.ts` — `PO-YYYY-####` formatting

## Events

See [EVENTS.md](./EVENTS.md).

## Dependencies

- `wms` — on-hand increment via `InventoryService.receive` on PO receipt

## Future integration

EDI / public vendor portal would replace staff-on-behalf intake on `acknowledgePurchaseOrder` and `submitAsn`.
