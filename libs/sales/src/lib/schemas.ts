import { z } from 'zod';

export const convertFromQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  requestedShipDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const getOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export const listOrdersSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'ALLOCATED',
      'BACKORDERED',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
      'CANCELLED',
    ])
    .optional(),
  hasBackorder: z.boolean().optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const allocateOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export const shipmentLineSchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.number().positive(),
  binId: z.string().uuid().optional(),
});

export const confirmShipmentSchema = z.object({
  orderId: z.string().uuid(),
  lines: z.array(shipmentLineSchema).min(1),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export type ConvertFromQuoteInput = z.infer<typeof convertFromQuoteSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type ConfirmShipmentInput = z.infer<typeof confirmShipmentSchema>;
