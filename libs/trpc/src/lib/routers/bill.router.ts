import { BillService, PaymentService } from 'finance';
import {
  createBillSchema,
  idSchema,
  listBillsSchema,
  recordBillPaymentSchema,
} from 'finance';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createBillRouter(
  billService: BillService,
  paymentService: PaymentService,
) {
  return router({
    create: editorProcedure
      .input(createBillSchema)
      .mutation(({ ctx, input }) =>
        billService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      billService.getById(input.id),
    ),

    list: protectedProcedure.input(listBillsSchema).query(({ input }) =>
      billService.list(input),
    ),

    post: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      billService.post(input.id, ctx.user?.userId),
    ),

    void: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      billService.voidBill(input.id, ctx.user?.userId),
    ),

    recordPayment: editorProcedure
      .input(recordBillPaymentSchema)
      .mutation(({ ctx, input }) =>
        paymentService.recordBillPayment(input, ctx.user?.userId),
      ),
  });
}
