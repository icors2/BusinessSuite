/** Standard Chart of Accounts codes used for auto-posting. */
export const DEFAULT_ACCOUNTS = {
  CASH: '1000',
  ACCOUNTS_RECEIVABLE: '1100',
  ACCOUNTS_PAYABLE: '2000',
  EQUITY: '3000',
  SALES_REVENUE: '4000',
  OPERATING_EXPENSE: '5000',
} as const;

export const FINANCE_EVENTS = {
  journal: {
    posted: 'finance.journal.posted',
    reversed: 'finance.journal.reversed',
  },
  invoice: {
    created: 'finance.invoice.created',
    posted: 'finance.invoice.posted',
    paid: 'finance.invoice.paid',
    voided: 'finance.invoice.voided',
  },
  bill: {
    created: 'finance.bill.created',
    posted: 'finance.bill.posted',
    paid: 'finance.bill.paid',
    voided: 'finance.bill.voided',
  },
  payment: {
    recorded: 'finance.payment.recorded',
  },
} as const;

export const ALL_FINANCE_TOPICS = [
  ...Object.values(FINANCE_EVENTS.journal),
  ...Object.values(FINANCE_EVENTS.invoice),
  ...Object.values(FINANCE_EVENTS.bill),
  FINANCE_EVENTS.payment.recorded,
] as const;
