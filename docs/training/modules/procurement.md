# Procurement — Purchase Orders

## Purpose

Create POs from approved MRP requisitions, issue to vendors, acknowledge, submit ASN, receive against PO, and view vendor scorecards.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Full PO lifecycle |
| Viewer | Read POs and scorecards |

## UI routes

| Route | Description |
|-------|-------------|
| `/procurement/purchase-orders` | PO list and lifecycle actions |
| `/procurement/scorecard` | Vendor on-time and quantity accuracy |

## Key tasks

1. From **MRP Procurement** page, approve requisitions (see MPS/MRP guide).
2. **Create purchase orders** from approved requisitions.
3. **Issue** PO to vendor.
4. **Acknowledge** and **submit ASN** (advance ship notice).
5. **Receive against PO** — increments WMS inventory.
6. Review **Vendor scorecard** metrics.

## Permissions

- Mutations require **Admin** or **Manager**.

## tRPC procedures

- `procurement`: createPurchaseOrders, issuePurchaseOrder, acknowledgePurchaseOrder, submitAsn, receiveAgainstPo, listPurchaseOrders, getPurchaseOrder, getVendorScorecard

## Related events

`procurement.po.created`, `procurement.po.issued`, `procurement.po.received`

## Demo login

`manager@arcncode.local` / `Manager123!`
