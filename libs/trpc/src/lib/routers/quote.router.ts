import {
  CpqCatalogService,
  QuoteService,
  addFabricatedLineSchema,
  addProductLineSchema,
  createQuoteSchema,
  getQuoteSchema,
  listQuotesSchema,
  pricePreviewSchema,
  recalcQuoteSchema,
  removeLineSchema,
  searchCatalogSchema,
  searchProductsSchema,
  transitionQuoteSchema,
  updateFormulasSchema,
  updateLineSchema,
  updatePricingConfigSchema,
  updateRateCardSchema,
} from 'cpq';
import { editorProcedure, protectedProcedure, router } from '../trpc';

const adminProcedure = editorProcedure.use(({ ctx, next }) => {
  const roles = ctx.user?.roles ?? [];
  if (!roles.includes('Admin')) {
    throw new Error('Admin role required');
  }
  return next({ ctx });
});

export function createQuoteRouter(quoteService: QuoteService) {
  return router({
    create: editorProcedure
      .input(createQuoteSchema)
      .mutation(({ ctx, input }) =>
        quoteService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure
      .input(getQuoteSchema)
      .query(({ input }) => quoteService.getById(input.quoteId)),

    list: protectedProcedure
      .input(listQuotesSchema)
      .query(({ input }) => quoteService.list(input)),

    addProductLine: editorProcedure
      .input(addProductLineSchema)
      .mutation(({ ctx, input }) =>
        quoteService.addProductLine(input, ctx.user?.userId),
      ),

    addFabricatedLine: editorProcedure
      .input(addFabricatedLineSchema)
      .mutation(({ ctx, input }) =>
        quoteService.addFabricatedLine(input, ctx.user?.userId),
      ),

    updateLine: editorProcedure
      .input(updateLineSchema)
      .mutation(({ ctx, input }) =>
        quoteService.updateLine(input, ctx.user?.userId),
      ),

    removeLine: editorProcedure
      .input(removeLineSchema)
      .mutation(({ ctx, input }) =>
        quoteService.removeLine(input.quoteId, input.lineId, ctx.user?.userId),
      ),

    recalc: editorProcedure
      .input(recalcQuoteSchema)
      .mutation(({ ctx, input }) =>
        quoteService.recalc(input.quoteId, ctx.user?.userId),
      ),

    transition: editorProcedure
      .input(transitionQuoteSchema)
      .mutation(({ ctx, input }) =>
        quoteService.transition(input.quoteId, input.action, ctx.user?.userId),
      ),

    pricePreview: protectedProcedure
      .input(pricePreviewSchema)
      .query(({ input }) => quoteService.pricePreview(input)),
  });
}

export function createCpqCatalogRouter(catalogService: CpqCatalogService) {
  return router({
    searchMaterials: protectedProcedure
      .input(searchCatalogSchema)
      .query(({ input }) =>
        catalogService.searchMaterials(input.query, input.limit),
      ),

    searchParts: protectedProcedure
      .input(searchCatalogSchema)
      .query(({ input }) =>
        catalogService.searchParts(input.query, input.limit),
      ),

    searchProducts: protectedProcedure
      .input(searchProductsSchema)
      .query(({ input }) =>
        catalogService.searchProducts(
          input.query,
          input.customerId,
          input.quantity,
          input.limit,
        ),
      ),

    getSettings: protectedProcedure.query(() => catalogService.getSettings()),

    updateRateCard: adminProcedure
      .input(updateRateCardSchema)
      .mutation(({ input }) => catalogService.updateRateCard(input)),

    updatePricingConfig: adminProcedure
      .input(updatePricingConfigSchema)
      .mutation(({ input }) => catalogService.updatePricingConfig(input)),

    updateFormulas: adminProcedure
      .input(updateFormulasSchema)
      .mutation(({ input }) => catalogService.updateFormulas(input.overrides)),
  });
}
