import {
  ReturnsService,
  approveRmaSchema,
  getRmaSchema,
  listRmasSchema,
  receiveRmaSchema,
  rejectRmaSchema,
  requestRmaSchema,
  resolveRmaSchema,
} from 'returns';
import { protectedProcedure, router, supportProcedure } from '../trpc';

export function createReturnsRouter(returnsService: ReturnsService) {
  return router({
    requestRma: supportProcedure
      .input(requestRmaSchema)
      .mutation(({ ctx, input }) =>
        returnsService.requestRma(input, ctx.user?.userId),
      ),

    approveRma: supportProcedure
      .input(approveRmaSchema)
      .mutation(({ ctx, input }) =>
        returnsService.approveRma(input, ctx.user?.userId),
      ),

    rejectRma: supportProcedure
      .input(rejectRmaSchema)
      .mutation(({ ctx, input }) =>
        returnsService.rejectRma(input, ctx.user?.userId),
      ),

    receiveRma: supportProcedure
      .input(receiveRmaSchema)
      .mutation(({ ctx, input }) =>
        returnsService.receiveRma(input, ctx.user?.userId),
      ),

    resolveRma: supportProcedure
      .input(resolveRmaSchema)
      .mutation(({ ctx, input }) =>
        returnsService.resolveRma(input, ctx.user?.userId),
      ),

    listRmas: protectedProcedure
      .input(listRmasSchema)
      .query(({ input }) => returnsService.listRmas(input)),

    getRma: protectedProcedure
      .input(getRmaSchema)
      .query(({ input }) => returnsService.getRma(input)),
  });
}
