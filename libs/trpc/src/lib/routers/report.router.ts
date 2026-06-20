import { ReportService } from 'finance';
import { balanceSheetSchema, reportDateRangeSchema } from 'finance';
import { protectedProcedure, router } from '../trpc';

export function createReportRouter(reportService: ReportService) {
  return router({
    profitAndLoss: protectedProcedure
      .input(reportDateRangeSchema)
      .query(({ input }) =>
        reportService.profitAndLoss(input.from, input.to),
      ),

    balanceSheet: protectedProcedure
      .input(balanceSheetSchema)
      .query(({ input }) => reportService.balanceSheet(input.asOf)),
  });
}
