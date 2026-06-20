import { z } from 'zod';

export const quoteStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);

export const quoteTransitionSchema = z.enum([
  'send',
  'accept',
  'reject',
  'expire',
]);

export const createQuoteSchema = z.object({
  customerId: z.string().uuid(),
  validUntil: z.coerce.date().optional(),
  notes: z.string().optional(),
  currency: z.string().min(3).max(3).optional().default('USD'),
});

export const getQuoteSchema = z.object({
  quoteId: z.string().uuid(),
});

export const listQuotesSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: quoteStatusSchema.optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

const fabPartSchema = z.record(z.string(), z.unknown());

export const addProductLineSchema = z.object({
  quoteId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  manualUnitPrice: z.number().nonnegative().optional(),
  overrideReason: z.string().optional(),
});

export const addFabricatedLineSchema = z.object({
  quoteId: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  fabInput: fabPartSchema,
});

export const updateLineSchema = z.object({
  quoteId: z.string().uuid(),
  lineId: z.string().uuid(),
  quantity: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  manualUnitPrice: z.number().nonnegative().nullable().optional(),
  overrideReason: z.string().nullable().optional(),
  fabInput: fabPartSchema.optional(),
});

export const removeLineSchema = z.object({
  quoteId: z.string().uuid(),
  lineId: z.string().uuid(),
});

export const recalcQuoteSchema = z.object({
  quoteId: z.string().uuid(),
});

export const transitionQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  action: quoteTransitionSchema,
});

export const pricePreviewSchema = z.object({
  fabInput: fabPartSchema.optional(),
  parts: z.array(fabPartSchema).optional(),
  quantity: z.number().positive().optional().default(1),
  rateCard: z.record(z.string(), z.unknown()).optional(),
  pricing: z.record(z.string(), z.unknown()).optional(),
});

export const searchCatalogSchema = z.object({
  query: z.string().optional().default(''),
  limit: z.number().int().min(1).max(50).optional().default(25),
});

export const searchProductsSchema = z.object({
  query: z.string().optional().default(''),
  customerId: z.string().uuid().optional(),
  quantity: z.number().positive().optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(25),
});

export const updateRateCardSchema = z.object({
  materialMargin: z.number().positive().optional(),
  laborMargin: z.number().positive().optional(),
  ratesPerMin: z.record(z.string(), z.number()).optional(),
  minutesPerFeature: z.record(z.string(), z.number()).optional(),
});

export const updatePricingConfigSchema = z.object({
  setupBaseCost: z.number().nonnegative().optional(),
  extraMargin: z.number().min(0).max(0.99).optional(),
  priceRounding: z.number().positive().optional(),
  quantityBreaks: z.array(z.number().int().positive()).optional(),
  tierDiscounts: z.record(z.string(), z.number()).optional(),
  volumeBreaks: z
    .array(
      z.object({
        minQty: z.number().positive(),
        discountPct: z.number().min(0).max(100),
      }),
    )
    .optional(),
});

export const updateFormulasSchema = z.object({
  overrides: z.record(z.string(), z.string()),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type ListQuotesInput = z.infer<typeof listQuotesSchema>;
export type AddProductLineInput = z.infer<typeof addProductLineSchema>;
export type AddFabricatedLineInput = z.infer<typeof addFabricatedLineSchema>;
export type UpdateLineInput = z.infer<typeof updateLineSchema>;
export type PricePreviewInput = z.infer<typeof pricePreviewSchema>;
