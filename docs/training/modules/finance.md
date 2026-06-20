# Finance — Accounts, AR/AP, Reports

## Purpose

Double-entry accounting: chart of accounts, journal entries, customer invoices (AR), vendor bills (AP), payments, and financial reports.

## Who uses it

| Role | Access |
|------|--------|
| Admin, Manager | Create, post, void, record payments |
| Viewer | Read reports and lists |

## UI routes

| Route | Description |
|-------|-------------|
| `/finance/accounts` | Chart of accounts |
| `/finance/invoices` | Customer invoices |
| `/finance/bills` | Vendor bills |
| `/finance/reports` | P&L and balance sheet |

## Key tasks

1. Review seeded accounts (`1000` Cash through `5000` OpEx).
2. Create a draft invoice for a customer; post to generate AR journal (DR AR 1100, CR Revenue 4000).
3. Record a customer payment against a posted invoice.
4. Create and post a vendor bill; record payment.
5. Run **Reports** — Profit & Loss and Balance Sheet for a date range.

## Permissions

- Writes require **Admin** or **Manager** (`canEdit`).
- Sales shipment auto-creates and posts invoices (Phase 7 integration).

## tRPC procedures

- `account`, `journal`, `invoice`, `bill`, `report`

## Related events

`finance.journal.posted`, `finance.invoice.*`, `finance.bill.*`, `finance.payment.recorded`, `finance.creditmemo.*`

## Demo login

`manager@arcncode.local` / `Manager123!`
