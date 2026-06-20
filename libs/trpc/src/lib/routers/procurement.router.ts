import {
  ProcurementService,
  acknowledgePoSchema,
  createPurchaseOrdersSchema,
  getPurchaseOrderSchema,
  issuePoSchema,
  listPurchaseOrdersSchema,
  receiveAgainstPoSchema,
  submitAsnSchema,
  vendorScorecardSchema,
} from 'procurement';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createProcurementRouter(procurementService: ProcurementService) {
  return router({
    createPurchaseOrders: editorProcedure
      .input(createPurchaseOrdersSchema)
      .mutation(({ ctx, input }) =>
        procurementService.createPurchaseOrders(input, ctx.user?.userId),
      ),

    issuePurchaseOrder: editorProcedure
      .input(issuePoSchema)
      .mutation(({ ctx, input }) =>
        procurementService.issuePurchaseOrder(input, ctx.user?.userId),
      ),

    acknowledgePurchaseOrder: editorProcedure
      .input(acknowledgePoSchema)
      .mutation(({ ctx, input }) =>
        procurementService.acknowledgePurchaseOrder(input, ctx.user?.userId),
      ),

    submitAsn: editorProcedure
      .input(submitAsnSchema)
      .mutation(({ ctx, input }) =>
        procurementService.submitAsn(input, ctx.user?.userId),
      ),

    receiveAgainstPo: editorProcedure
      .input(receiveAgainstPoSchema)
      .mutation(({ ctx, input }) =>
        procurementService.receiveAgainstPo(input, ctx.user?.userId),
      ),

    listPurchaseOrders: protectedProcedure
      .input(listPurchaseOrdersSchema)
      .query(({ input }) => procurementService.listPurchaseOrders(input)),

    getPurchaseOrder: protectedProcedure
      .input(getPurchaseOrderSchema)
      .query(({ input }) =>
        procurementService.getPurchaseOrder(input.purchaseOrderId),
      ),

    getVendorScorecard: protectedProcedure
      .input(vendorScorecardSchema)
      .query(({ input }) => procurementService.getVendorScorecard(input)),
  });
}
