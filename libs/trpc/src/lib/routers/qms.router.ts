import {
  QmsService,
  addCriterionSchema,
  completeInspectionSchema,
  dispositionSchema,
  getInspectionSchema,
  getNonConformanceSchema,
  getTemplateSchema,
  listInspectionsSchema,
  listNonConformancesSchema,
  listTemplatesSchema,
  raiseNonConformanceSchema,
  reportScrapSchema,
  upsertTemplateSchema,
} from 'qms';
import {
  editorProcedure,
  inspectorProcedure,
  protectedProcedure,
  router,
  supervisorProcedure,
} from '../trpc';

export function createQmsRouter(qmsService: QmsService) {
  return router({
    upsertTemplate: editorProcedure
      .input(upsertTemplateSchema)
      .mutation(({ ctx, input }) =>
        qmsService.upsertTemplate(input, ctx.user?.userId),
      ),

    addCriterion: editorProcedure
      .input(addCriterionSchema)
      .mutation(({ ctx, input }) =>
        qmsService.addCriterion(input, ctx.user?.userId),
      ),

    completeInspection: inspectorProcedure
      .input(completeInspectionSchema)
      .mutation(({ ctx, input }) =>
        qmsService.completeInspection(input, ctx.user?.userId),
      ),

    raiseNonConformance: inspectorProcedure
      .input(raiseNonConformanceSchema)
      .mutation(({ ctx, input }) =>
        qmsService.raiseNonConformance(input, ctx.user?.userId),
      ),

    reportScrap: inspectorProcedure
      .input(reportScrapSchema)
      .mutation(({ ctx, input }) =>
        qmsService.reportScrap(input, ctx.user?.userId),
      ),

    disposition: supervisorProcedure
      .input(dispositionSchema)
      .mutation(({ ctx, input }) =>
        qmsService.disposition(input, ctx.user?.userId),
      ),

    listTemplates: protectedProcedure
      .input(listTemplatesSchema)
      .query(({ input }) => qmsService.listTemplates(input)),

    getTemplate: protectedProcedure
      .input(getTemplateSchema)
      .query(({ input }) => qmsService.getTemplate(input)),

    listInspections: protectedProcedure
      .input(listInspectionsSchema)
      .query(({ input }) => qmsService.listInspections(input)),

    getInspection: protectedProcedure
      .input(getInspectionSchema)
      .query(({ input }) => qmsService.getInspection(input)),

    listNonConformances: protectedProcedure
      .input(listNonConformancesSchema)
      .query(({ input }) => qmsService.listNonConformances(input)),

    getNonConformance: protectedProcedure
      .input(getNonConformanceSchema)
      .query(({ input }) => qmsService.getNonConformance(input)),
  });
}
