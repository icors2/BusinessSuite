import { z } from 'zod';

/**
 * Expected legacy input schemas.
 *
 * The legacy system's native export format is not fixed, so the transform layer
 * accepts CSV or JSON whose columns/keys match the shapes below. Point the ETL
 * at whatever the legacy system produces after mapping it to these field names.
 *
 * All fields arrive as strings (CSV has no types); coercion/validation happens
 * in the transform step so we can record conflicts rather than throw.
 */

export type MigrationEntity = 'customer' | 'vendor' | 'product' | 'quote';

export const MIGRATION_ENTITIES: MigrationEntity[] = [
  'customer',
  'vendor',
  'product',
  'quote',
];

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

export const legacyCustomerSchema = z.object({
  sourceId: z.string().min(1, 'sourceId is required'),
  name: optionalString,
  email: optionalString,
  phone: optionalString,
  billingLine1: optionalString,
  billingCity: optionalString,
  billingState: optionalString,
  billingPostalCode: optionalString,
  billingCountry: optionalString,
  shippingLine1: optionalString,
  shippingCity: optionalString,
  shippingState: optionalString,
  shippingPostalCode: optionalString,
  shippingCountry: optionalString,
  creditTerms: optionalString,
});

export const legacyVendorSchema = z.object({
  sourceId: z.string().min(1, 'sourceId is required'),
  name: optionalString,
  email: optionalString,
  phone: optionalString,
  addressLine1: optionalString,
  addressCity: optionalString,
  addressState: optionalString,
  addressPostalCode: optionalString,
  addressCountry: optionalString,
  paymentTerms: optionalString,
});

export const legacyProductSchema = z.object({
  sourceId: z.string().min(1, 'sourceId is required'),
  sku: optionalString,
  description: optionalString,
  unitOfMeasure: optionalString,
  category: optionalString,
  inventoryOnHand: optionalString,
});

export const legacyQuoteSchema = z.object({
  sourceId: z.string().min(1, 'sourceId is required'),
  customerSourceId: optionalString,
  quoteNumber: optionalString,
  status: optionalString,
  totalAmount: optionalString,
  currency: optionalString,
  quotedAt: optionalString,
  lineItems: optionalString,
});

export type LegacyCustomer = z.infer<typeof legacyCustomerSchema>;
export type LegacyVendor = z.infer<typeof legacyVendorSchema>;
export type LegacyProduct = z.infer<typeof legacyProductSchema>;
export type LegacyQuote = z.infer<typeof legacyQuoteSchema>;

export const expectedSchemas = {
  customer: legacyCustomerSchema,
  vendor: legacyVendorSchema,
  product: legacyProductSchema,
  quote: legacyQuoteSchema,
} as const;
