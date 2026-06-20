import {
  WorkforceService,
  assignShiftSchema,
  clockInSchema,
  clockOutSchema,
  createEmployeeSchema,
  laborCostReportSchema,
  listAssignmentsSchema,
  listEmployeesSchema,
  listShiftsSchema,
  markUnavailableSchema,
  updateEmployeeSchema,
  upsertShiftSchema,
} from 'workforce';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createWorkforceRouter(workforceService: WorkforceService) {
  return router({
    createEmployee: editorProcedure
      .input(createEmployeeSchema)
      .mutation(({ ctx, input }) =>
        workforceService.createEmployee(input, ctx.user?.userId),
      ),

    updateEmployee: editorProcedure
      .input(updateEmployeeSchema)
      .mutation(({ ctx, input }) =>
        workforceService.updateEmployee(input, ctx.user?.userId),
      ),

    upsertShift: editorProcedure
      .input(upsertShiftSchema)
      .mutation(({ ctx, input }) =>
        workforceService.upsertShift(input, ctx.user?.userId),
      ),

    assignShift: editorProcedure
      .input(assignShiftSchema)
      .mutation(({ ctx, input }) =>
        workforceService.assignShift(input, ctx.user?.userId),
      ),

    markUnavailable: editorProcedure
      .input(markUnavailableSchema)
      .mutation(({ ctx, input }) =>
        workforceService.markUnavailable(input, ctx.user?.userId),
      ),

    clockIn: editorProcedure
      .input(clockInSchema)
      .mutation(({ ctx, input }) =>
        workforceService.clockIn(input, ctx.user?.userId),
      ),

    clockOut: editorProcedure
      .input(clockOutSchema)
      .mutation(({ ctx, input }) =>
        workforceService.clockOut(input, ctx.user?.userId),
      ),

    listEmployees: protectedProcedure
      .input(listEmployeesSchema)
      .query(({ input }) => workforceService.listEmployees(input)),

    listShifts: protectedProcedure
      .input(listShiftsSchema)
      .query(({ input }) => workforceService.listShifts(input)),

    listAssignments: protectedProcedure
      .input(listAssignmentsSchema)
      .query(({ input }) => workforceService.listAssignments(input)),

    listOpenTimeEntries: protectedProcedure.query(() =>
      workforceService.listOpenTimeEntries(),
    ),

    getLaborCostReport: protectedProcedure
      .input(laborCostReportSchema)
      .query(({ input }) => workforceService.getLaborCostReport(input)),
  });
}
