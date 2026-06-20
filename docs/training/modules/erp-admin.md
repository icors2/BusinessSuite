# ERP Admin — Products, Customers, Vendors

## Purpose

Maintain master data: products (SKU, pricing, procurement settings), customers, and vendors used across CPQ, Sales, Finance, WMS, and MRP.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Create, update, deactivate |
| Viewer | Read-only list/detail |

## UI routes

| Route | Description |
|-------|-------------|
| `/products` | Product list and editor |
| `/customers` | Customer list and editor |
| `/vendors` | Vendor list and editor |

## Key tasks

### Products
1. Sign in as `manager@arcncode.local` / `Manager123!`.
2. Open **Products** — seeded SKUs include `SKU-001`, `SKU-002`.
3. Create or update a product (SKU, description, UOM, list price, lead time, preferred vendor).
4. Deactivate obsolete products (soft delete).

### Customers & Vendors
1. Open **Customers** or **Vendors**.
2. Create a record with name, contact, and payment terms.
3. Update or deactivate as needed.

## Permissions

- Writes require **Admin** or **Manager** (`editorProcedure` / `canEdit`).
- All authenticated users can list and view.

## tRPC procedures

- `product`: create, get, list, update, deactivate
- `customer`: create, get, list, update, deactivate
- `vendor`: create, get, list, update, deactivate

## Related events

`masterdata.product.*`, `masterdata.customer.*`, `masterdata.vendor.*`

## Demo login

`manager@arcncode.local` / `Manager123!`
