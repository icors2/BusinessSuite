import { z } from 'zod';

export const addressSchema = z
  .object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1).default('US'),
  })
  .optional();

export const createProductSchema = z.object({
  sku: z.string().min(1).max(64),
  description: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  category: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsSchema = z.object({
  search: z.string().optional(),
  includeInactive: z.boolean().optional().default(false),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  creditTerms: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersSchema = z.object({
  search: z.string().optional(),
  includeInactive: z.boolean().optional().default(false),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const createVendorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: addressSchema,
  paymentTerms: z.string().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const listVendorsSchema = z.object({
  search: z.string().optional(),
  includeInactive: z.boolean().optional().default(false),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const idSchema = z.object({ id: z.string().uuid() });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
