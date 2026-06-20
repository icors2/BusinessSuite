import {
  AnalyticsService,
  askSchema,
  eventVolumeSchema,
  getForecastsSchema,
  scrapRateSchema,
} from 'analytics';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createAnalyticsRouter(analyticsService: AnalyticsService) {
  return router({
    ask: protectedProcedure
      .input(askSchema)
      .query(({ input }) => analyticsService.answer(input.question)),

    getEventVolume: protectedProcedure
      .input(eventVolumeSchema)
      .query(({ input }) => analyticsService.getEventVolume(input)),

    getScrapRate: protectedProcedure
      .input(scrapRateSchema)
      .query(({ input }) => analyticsService.getScrapRate(input)),

    getBottlenecks: protectedProcedure.query(() =>
      analyticsService.getBottlenecks(),
    ),

    getForecasts: protectedProcedure
      .input(getForecastsSchema)
      .query(({ input }) => analyticsService.getForecasts(input)),

    getIngestionStatus: protectedProcedure.query(() =>
      analyticsService.getIngestionStatus(),
    ),

    recomputeForecasts: editorProcedure.mutation(({ ctx }) =>
      analyticsService.computeInventoryForecasts(ctx.user?.userId),
    ),
  });
}
