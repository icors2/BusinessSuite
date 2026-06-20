# Procurement Events

| Topic | When | Payload |
|-------|------|---------|
| `procurement.po.issued` | PO status moves to ISSUED | `purchaseOrderId`, `poNumber`, `vendorId`, `total` |
| `procurement.po.acknowledged` | Vendor acknowledgment recorded | `purchaseOrderId`, `poNumber`, `acknowledgmentId`, `confirmedDeliveryDate` |
| `procurement.asn.received` | Advance shipment notice submitted | `purchaseOrderId`, `asnId`, `expectedArrival`, `lineCount` |
