import { z } from 'zod';

const quantitySchema = z.number().positive();
const optionalNoteSchema = z.string().optional();

const productRefFields = {
  productId: z.string().uuid().optional(),
  sku: z.string().min(1).optional(),
};

const binRefFields = {
  binId: z.string().uuid().optional(),
  binCode: z.string().min(1).optional(),
};

const productRefine = {
  refine: (v: { productId?: string; sku?: string }) => Boolean(v.productId || v.sku),
  message: 'productId or sku is required' as const,
};

const binRefine = {
  refine: (v: { binId?: string; binCode?: string }) => Boolean(v.binId || v.binCode),
  message: 'binId or binCode is required' as const,
};

export const createLocationSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  type: z.string().optional(),
});

export const listLocationsSchema = z.object({
  search: z.string().optional(),
  includeInactive: z.boolean().optional().default(false),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const createBinSchema = z.object({
  locationId: z.string().uuid(),
  code: z.string().min(1).max(64),
  description: z.string().optional(),
});

export const listBinsSchema = z.object({
  locationId: z.string().uuid().optional(),
  search: z.string().optional(),
  includeInactive: z.boolean().optional().default(false),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const receiveSchema = z
  .object({
    ...productRefFields,
    ...binRefFields,
    quantity: quantitySchema,
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(binRefine.refine, { message: binRefine.message });

export const moveSchema = z
  .object({
    ...productRefFields,
    fromBinId: z.string().uuid().optional(),
    fromBinCode: z.string().min(1).optional(),
    toBinId: z.string().uuid().optional(),
    toBinCode: z.string().min(1).optional(),
    quantity: quantitySchema,
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(
    (v) => (v.fromBinId || v.fromBinCode) && (v.toBinId || v.toBinCode),
    { message: 'from and to bin references are required' },
  );

export const pickSchema = z
  .object({
    ...productRefFields,
    ...binRefFields,
    quantity: quantitySchema,
    allowNegative: z.boolean().optional(),
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(binRefine.refine, { message: binRefine.message });

export const shipSchema = z
  .object({
    ...productRefFields,
    ...binRefFields,
    quantity: quantitySchema,
    allowNegative: z.boolean().optional(),
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(binRefine.refine, { message: binRefine.message });

export const adjustSchema = z
  .object({
    ...productRefFields,
    ...binRefFields,
    quantityDelta: z
      .number()
      .refine((n) => n !== 0, { message: 'quantityDelta cannot be zero' }),
    reasonCode: z.string().min(1),
    allowNegative: z.boolean().optional(),
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(binRefine.refine, { message: binRefine.message });

export const allocateSchema = z
  .object({
    ...productRefFields,
    ...binRefFields,
    quantity: quantitySchema,
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(binRefine.refine, { message: binRefine.message });

export const deallocateSchema = z
  .object({
    ...productRefFields,
    ...binRefFields,
    quantity: quantitySchema,
    note: optionalNoteSchema,
  })
  .refine(productRefine.refine, { message: productRefine.message })
  .refine(binRefine.refine, { message: binRefine.message });

export const lookupByProductSchema = z
  .object({
    productId: z.string().uuid().optional(),
    sku: z.string().min(1).optional(),
  })
  .refine(productRefine.refine, { message: productRefine.message });

export const lookupByBinSchema = z
  .object({
    binId: z.string().uuid().optional(),
    binCode: z.string().min(1).optional(),
  })
  .refine(binRefine.refine, { message: binRefine.message });

export const lookupByLocationSchema = z
  .object({
    locationId: z.string().uuid().optional(),
    locationCode: z.string().min(1).optional(),
  })
  .refine((v) => v.locationId || v.locationCode, {
    message: 'locationId or locationCode is required',
  });

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type CreateBinInput = z.infer<typeof createBinSchema>;
export type ReceiveInput = z.infer<typeof receiveSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type PickInput = z.infer<typeof pickSchema>;
export type ShipInput = z.infer<typeof shipSchema>;
export type AdjustInput = z.infer<typeof adjustSchema>;
export type AllocateInput = z.infer<typeof allocateSchema>;
export type DeallocateInput = z.infer<typeof deallocateSchema>;
