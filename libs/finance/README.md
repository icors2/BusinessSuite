# Finance Library (Phase 3)

Core financial ledger — Chart of Accounts, double-entry journal entries,
Accounts Receivable (invoices), Accounts Payable (bills), payments, and P&L /
Balance Sheet reports.

## Architecture

Finance is the **financial source of truth**. Other modules must emit events
(or call these services) rather than writing directly to ledger tables.

- **Journal entries** must balance before posting; posted entries are immutable.
- Corrections use **reversing entries**, not edits.
- Invoices/bills/payments auto-post balanced GL entries.

## Auto-posting (default COA codes)

| Event | Debit | Credit |
|-------|-------|--------|
| Invoice posted | Accounts Receivable (1100) | Sales Revenue (4000) |
| Invoice payment | Cash (1000) | Accounts Receivable (1100) |
| Bill posted | Expense (per line) | Accounts Payable (2000) |
| Bill payment | Accounts Payable (2000) | Cash (1000) |

## tRPC routers

Mounted under `account`, `journal`, `invoice`, `bill`, `report` in the app router.

## Events

See [EVENTS.md](./EVENTS.md).
