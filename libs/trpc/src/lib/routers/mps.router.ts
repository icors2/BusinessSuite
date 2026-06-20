import {
  MpsService,
  generateScheduleSchema,
  getCalendarSchema,
  getWorkOrderSchema,
  listWorkOrdersSchema,
  previewDemandSchema,
  rescheduleWorkOrderSchema,
  setProductStrategySchema,
  setStrategySchema,
  upsertCalendarDaySchema,
  upsertLineSchema,
} from 'mps';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createMpsRouter(mpsService: MpsService) {
  return router({
    previewDemand: protectedProcedure
      .input(previewDemandSchema)
      .query(({ input }) => mpsService.previewDemand(input)),

    generateSchedule: editorProcedure
      .input(generateScheduleSchema)
      .mutation(({ ctx, input }) =>
        mpsService.generateSchedule(input, ctx.user?.userId),
      ),

    listWorkOrders: protectedProcedure
      .input(listWorkOrdersSchema)
      .query(({ input }) => mpsService.listWorkOrders(input)),

    getWorkOrder: protectedProcedure
      .input(getWorkOrderSchema)
      .query(({ input }) => mpsService.getWorkOrder(input.workOrderId)),

    listLines: protectedProcedure.query(() => mpsService.listLines()),

    getCalendar: protectedProcedure
      .input(getCalendarSchema)
      .query(({ input }) => mpsService.getCalendar(input)),

    rescheduleWorkOrder: editorProcedure
      .input(rescheduleWorkOrderSchema)
      .mutation(({ ctx, input }) =>
        mpsService.rescheduleWorkOrder(input, ctx.user?.userId),
      ),

    upsertLine: editorProcedure
      .input(upsertLineSchema)
      .mutation(({ ctx, input }) =>
        mpsService.upsertLine(input, ctx.user?.userId),
      ),

    upsertCalendarDay: editorProcedure
      .input(upsertCalendarDaySchema)
      .mutation(({ ctx, input }) =>
        mpsService.upsertCalendarDay(input, ctx.user?.userId),
      ),

    setStrategy: editorProcedure
      .input(setStrategySchema)
      .mutation(({ ctx, input }) =>
        mpsService.setStrategy(input, ctx.user?.userId),
      ),

    setProductStrategy: editorProcedure
      .input(setProductStrategySchema)
      .mutation(({ ctx, input }) =>
        mpsService.setProductStrategy(input, ctx.user?.userId),
      ),

    listSettings: protectedProcedure.query(() => mpsService.listSettings()),
  });
}
