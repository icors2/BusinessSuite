import {
  MrpService,
  getBomSchema,
  listRequisitionsSchema,
  listRequirementsSchema,
  reviewRequisitionSchema,
  runMrpSchema,
  upsertBomSchema,
} from 'mrp';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createMrpRouter(mrpService: MrpService) {
  return router({
    runMrp: editorProcedure
      .input(runMrpSchema)
      .mutation(({ ctx }) => mrpService.runMrp(ctx.user?.userId)),

    getRequirements: protectedProcedure
      .input(listRequirementsSchema)
      .query(({ input }) => mrpService.getRequirements(input)),

    listRequisitions: protectedProcedure
      .input(listRequisitionsSchema)
      .query(({ input }) => mrpService.listRequisitions(input)),

    getBom: protectedProcedure
      .input(getBomSchema)
      .query(({ input }) => mrpService.getBom(input.productId)),

    reviewRequisition: editorProcedure
      .input(reviewRequisitionSchema)
      .mutation(({ ctx, input }) =>
        mrpService.reviewRequisition(input, ctx.user?.userId),
      ),

    upsertBom: editorProcedure
      .input(upsertBomSchema)
      .mutation(({ ctx, input }) =>
        mrpService.upsertBom(input, ctx.user?.userId),
      ),
  });
}
