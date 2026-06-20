import { z } from 'zod';

export const createPurchaseOrdersSchema = z.object({
  requisitionIds: z.array(z.string().uuid()).min(1),
});

export const issuePoSchema = z.object({
  purchaseOrderId: z.string().uuid(),
});

export const acknowledgePoSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  confirmedDeliveryDate: z.coerce.date().optional(),
  note: z.string().optional(),
});

export const asnLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const submitAsnSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  shipDate: z.coerce.date().optional(),
  expectedArrival: z.coerce.date().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  lines: z.array(asnLineSchema).min(1),
});

export const receiveAgainstPoSchema = z.object({
  poLineId: z.string().uuid(),
  quantity: z.number().positive(),
  binId: z.string().uuid(),
  receivedAt: z.coerce.date().optional(),
  note: z.string().optional(),
});

export const listPurchaseOrdersSchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'ISSUED',
      'ACKNOWLEDGED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CLOSED',
      'CANCELLED',
    ])
    .optional(),
  vendorId: z.string().uuid().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getPurchaseOrderSchema = z.object({
  purchaseOrderId: z.string().uuid(),
});

export const vendorScorecardSchema = z.object({
  vendorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreatePurchaseOrdersInput = z.infer<
  typeof createPurchaseOrdersSchema
>;
export type IssuePoInput = z.infer<typeof issuePoSchema>;
export type AcknowledgePoInput = z.infer<typeof acknowledgePoSchema>;
export type SubmitAsnInput = z.infer<typeof submitAsnSchema>;
export type ReceiveAgainstPoInput = z.infer<typeof receiveAgainstPoSchema>;
export type ListPurchaseOrdersInput = z.infer<typeof listPurchaseOrdersSchema>;
export type VendorScorecardInput = z.infer<typeof vendorScorecardSchema>;
