import { InvoiceService, PaymentService } from 'finance';
import {
  createInvoiceSchema,
  idSchema,
  listInvoicesSchema,
  recordInvoicePaymentSchema,
} from 'finance';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createInvoiceRouter(
  invoiceService: InvoiceService,
  paymentService: PaymentService,
) {
  return router({
    create: editorProcedure
      .input(createInvoiceSchema)
      .mutation(({ ctx, input }) =>
        invoiceService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      invoiceService.getById(input.id),
    ),

    list: protectedProcedure.input(listInvoicesSchema).query(({ input }) =>
      invoiceService.list(input),
    ),

    post: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      invoiceService.post(input.id, ctx.user?.userId),
    ),

    void: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      invoiceService.voidInvoice(input.id, ctx.user?.userId),
    ),

    recordPayment: editorProcedure
      .input(recordInvoicePaymentSchema)
      .mutation(({ ctx, input }) =>
        paymentService.recordInvoicePayment(input, ctx.user?.userId),
      ),
  });
}
