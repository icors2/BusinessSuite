import {
  SalesOrderService,
  allocateOrderSchema,
  cancelOrderSchema,
  confirmShipmentSchema,
  convertFromQuoteSchema,
  getOrderSchema,
  listOrdersSchema,
} from 'sales';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createSalesOrderRouter(salesOrderService: SalesOrderService) {
  return router({
    convert: editorProcedure
      .input(convertFromQuoteSchema)
      .mutation(({ ctx, input }) =>
        salesOrderService.convertFromQuote(input, ctx.user?.userId),
      ),

    get: protectedProcedure
      .input(getOrderSchema)
      .query(({ input }) => salesOrderService.getById(input.orderId)),

    list: protectedProcedure
      .input(listOrdersSchema)
      .query(({ input }) => salesOrderService.list(input)),

    allocate: editorProcedure
      .input(allocateOrderSchema)
      .mutation(({ ctx, input }) =>
        salesOrderService.allocate(input.orderId, ctx.user?.userId),
      ),

    confirmShipment: editorProcedure
      .input(confirmShipmentSchema)
      .mutation(({ ctx, input }) =>
        salesOrderService.confirmShipment(input, ctx.user?.userId),
      ),

    cancel: editorProcedure
      .input(cancelOrderSchema)
      .mutation(({ ctx, input }) =>
        salesOrderService.cancel(input.orderId, ctx.user?.userId),
      ),
  });
}
