import { z } from 'zod';

export const accountTypeSchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
]);

export const createAccountSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1),
  type: accountTypeSchema,
});

export const updateAccountSchema = createAccountSchema.partial();

export const listAccountsSchema = z.object({
  type: accountTypeSchema.optional(),
  includeInactive: z.boolean().optional().default(false),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  date: z.coerce.date(),
  memo: z.string().optional(),
  lines: z.array(journalLineSchema).min(2),
});

export const listJournalEntriesSchema = z.object({
  status: z.enum(['DRAFT', 'POSTED', 'REVERSED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const invoiceLineInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).optional(),
  customerId: z.string().uuid(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  lines: z.array(invoiceLineInputSchema).min(1),
});

export const listInvoicesSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z
    .enum(['DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'VOIDED'])
    .optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const creditMemoLineInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

export const createCreditMemoSchema = z.object({
  creditMemoNumber: z.string().min(1).optional(),
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  issueDate: z.coerce.date(),
  notes: z.string().optional(),
  lines: z.array(creditMemoLineInputSchema).min(1),
});

export const listCreditMemosSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'POSTED', 'VOIDED']).optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const billLineInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  expenseAccountId: z.string().uuid(),
});

export const createBillSchema = z.object({
  billNumber: z.string().min(1).optional(),
  vendorId: z.string().uuid(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  lines: z.array(billLineInputSchema).min(1),
});

export const listBillsSchema = z.object({
  vendorId: z.string().uuid().optional(),
  status: z
    .enum(['DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'VOIDED'])
    .optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  date: z.coerce.date(),
  method: z.string().optional(),
});

export const recordInvoicePaymentSchema = recordPaymentSchema.extend({
  invoiceId: z.string().uuid(),
});

export const recordBillPaymentSchema = recordPaymentSchema.extend({
  billId: z.string().uuid(),
});

export const reportDateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const balanceSheetSchema = z.object({
  asOf: z.coerce.date(),
});

export const idSchema = z.object({ id: z.string().uuid() });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateCreditMemoInput = z.infer<typeof createCreditMemoSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type RecordInvoicePaymentInput = z.infer<
  typeof recordInvoicePaymentSchema
>;
export type RecordBillPaymentInput = z.infer<typeof recordBillPaymentSchema>;
