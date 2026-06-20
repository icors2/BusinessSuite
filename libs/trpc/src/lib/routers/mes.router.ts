import {
  MesService,
  generateOperationsSchema,
  getDashboardSchema,
  getPlacardSchema,
  listOperationsSchema,
  listWorkstationsSchema,
  startOperationSchema,
  stopOperationSchema,
  upsertOperationSchema,
  upsertWorkstationSchema,
  verifyWorkOrderSchema,
} from 'mes';
import {
  editorProcedure,
  operatorProcedure,
  protectedProcedure,
  router,
  supervisorProcedure,
} from '../trpc';

export function createMesRouter(mesService: MesService) {
  return router({
    upsertWorkstation: editorProcedure
      .input(upsertWorkstationSchema)
      .mutation(({ ctx, input }) =>
        mesService.upsertWorkstation(input, ctx.user?.userId),
      ),

    upsertOperation: editorProcedure
      .input(upsertOperationSchema)
      .mutation(({ ctx, input }) =>
        mesService.upsertOperation(input, ctx.user?.userId),
      ),

    generateOperations: editorProcedure
      .input(generateOperationsSchema)
      .mutation(({ ctx, input }) =>
        mesService.generateOperations(input, ctx.user?.userId),
      ),

    startOperation: operatorProcedure
      .input(startOperationSchema)
      .mutation(({ ctx, input }) =>
        mesService.startOperation(input, ctx.user?.userId),
      ),

    stopOperation: operatorProcedure
      .input(stopOperationSchema)
      .mutation(({ ctx, input }) =>
        mesService.stopOperation(input, ctx.user?.userId),
      ),

    verifyWorkOrder: supervisorProcedure
      .input(verifyWorkOrderSchema)
      .mutation(({ ctx, input }) =>
        mesService.verifyWorkOrder(input, ctx.user?.userId),
      ),

    listWorkstations: protectedProcedure
      .input(listWorkstationsSchema)
      .query(({ input }) => mesService.listWorkstations(input)),

    listOperations: protectedProcedure
      .input(listOperationsSchema)
      .query(({ input }) => mesService.listOperations(input)),

    listOpenCycles: protectedProcedure.query(() =>
      mesService.listOpenCycles(),
    ),

    getDashboard: protectedProcedure
      .input(getDashboardSchema)
      .query(({ input }) => mesService.getDashboard(input)),

    getPlacard: protectedProcedure
      .input(getPlacardSchema)
      .query(({ input }) => mesService.getPlacard(input)),
  });
}
