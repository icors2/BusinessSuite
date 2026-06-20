import {
  CmmsService,
  cancelMaintenanceWorkOrderSchema,
  completeMaintenanceWorkOrderSchema,
  createMaintenanceWorkOrderSchema,
  getAssetSchema,
  getDueSoonSchema,
  getMaintenanceHistoryForWorkOrderSchema,
  getMaintenanceWorkOrderSchema,
  listAssetsSchema,
  listMaintenanceWorkOrdersSchema,
  listPmRulesSchema,
  startMaintenanceWorkOrderSchema,
  upsertAssetSchema,
  upsertPmRuleSchema,
} from 'cmms';
import {
  editorProcedure,
  protectedProcedure,
  router,
  technicianProcedure,
} from '../trpc';

export function createCmmsRouter(cmmsService: CmmsService) {
  return router({
    upsertAsset: editorProcedure
      .input(upsertAssetSchema)
      .mutation(({ ctx, input }) =>
        cmmsService.upsertAsset(input, ctx.user?.userId),
      ),

    upsertPmRule: editorProcedure
      .input(upsertPmRuleSchema)
      .mutation(({ ctx, input }) =>
        cmmsService.upsertPmRule(input, ctx.user?.userId),
      ),

    createMaintenanceWorkOrder: editorProcedure
      .input(createMaintenanceWorkOrderSchema)
      .mutation(({ ctx, input }) =>
        cmmsService.createMaintenanceWorkOrder(input, ctx.user?.userId),
      ),

    cancelMaintenanceWorkOrder: editorProcedure
      .input(cancelMaintenanceWorkOrderSchema)
      .mutation(({ ctx, input }) =>
        cmmsService.cancelMaintenanceWorkOrder(input, ctx.user?.userId),
      ),

    evaluateCalendarTriggers: editorProcedure
      .mutation(() => cmmsService.evaluateCalendarTriggers()),

    startMaintenanceWorkOrder: technicianProcedure
      .input(startMaintenanceWorkOrderSchema)
      .mutation(({ ctx, input }) =>
        cmmsService.startMaintenanceWorkOrder(input, ctx.user?.userId),
      ),

    completeMaintenanceWorkOrder: technicianProcedure
      .input(completeMaintenanceWorkOrderSchema)
      .mutation(({ ctx, input }) =>
        cmmsService.completeMaintenanceWorkOrder(input, ctx.user?.userId),
      ),

    listAssets: protectedProcedure
      .input(listAssetsSchema)
      .query(({ input }) => cmmsService.listAssets(input)),

    getAsset: protectedProcedure
      .input(getAssetSchema)
      .query(({ input }) => cmmsService.getAsset(input)),

    listPmRules: protectedProcedure
      .input(listPmRulesSchema)
      .query(({ input }) => cmmsService.listPmRules(input)),

    listMaintenanceWorkOrders: protectedProcedure
      .input(listMaintenanceWorkOrdersSchema)
      .query(({ input }) => cmmsService.listMaintenanceWorkOrders(input)),

    getMaintenanceWorkOrder: protectedProcedure
      .input(getMaintenanceWorkOrderSchema)
      .query(({ input }) => cmmsService.getMaintenanceWorkOrder(input)),

    getDueSoon: protectedProcedure
      .input(getDueSoonSchema)
      .query(({ input }) => cmmsService.getDueSoon(input)),

    getMaintenanceHistoryForWorkOrder: protectedProcedure
      .input(getMaintenanceHistoryForWorkOrderSchema)
      .query(({ input }) =>
        cmmsService.getMaintenanceHistoryForWorkOrder(input),
      ),
  });
}
