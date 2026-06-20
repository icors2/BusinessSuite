# Finance Events

Topic naming: `finance.entity.action` (lowercase).

| Topic | When emitted | Payload |
|-------|--------------|---------|
| `finance.journal.posted` | Journal entry posted | `{ entryNumber, total }` |
| `finance.journal.reversed` | Reversing entry created | `{ entryNumber, reversedEntryId }` |
| `finance.invoice.created` | Draft invoice created | `{ invoiceNumber, customerId, total }` |
| `finance.invoice.posted` | Invoice posted to GL | `{ invoiceNumber, total }` |
| `finance.invoice.paid` | Invoice fully paid | `{ invoiceNumber, totalPaid }` |
| `finance.invoice.voided` | Invoice voided | `{ invoiceNumber }` |
| `finance.bill.created` | Draft bill created | `{ billNumber, vendorId, total }` |
| `finance.bill.posted` | Bill posted to GL | `{ billNumber, total }` |
| `finance.bill.paid` | Bill fully paid | `{ billNumber, totalPaid }` |
| `finance.bill.voided` | Bill voided | `{ billNumber }` |
| `finance.payment.recorded` | Payment recorded | `{ type, invoiceId\|billId, amount }` |

Later phases (Sales Orders, Procurement) should trigger invoice/bill creation
via events rather than writing directly to Finance tables.
