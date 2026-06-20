import { z } from 'zod';

export const requestRmaSchema = z.object({
  salesOrderLineId: z.string().uuid(),
  reasonCode: z.enum([
    'DEFECTIVE',
    'WRONG_ITEM',
    'DAMAGED_IN_TRANSIT',
    'NOT_AS_DESCRIBED',
    'OTHER',
  ]),
  quantity: z.number().positive(),
  qualityRelated: z.boolean().optional(),
  notes: z.string().optional(),
});

export const approveRmaSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
});

export const rejectRmaSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
});

export const receiveRmaSchema = z.object({
  id: z.string().uuid(),
  binId: z.string().uuid().optional(),
  binCode: z.string().optional(),
  notes: z.string().optional(),
});

export const resolveRmaSchema = z.object({
  id: z.string().uuid(),
  resolutionType: z.enum(['REFUND', 'REPLACE', 'REPAIR', 'REJECT']),
  notes: z.string().optional(),
});

export const listRmasSchema = z.object({
  status: z
    .enum(['REQUESTED', 'APPROVED', 'RECEIVED', 'RESOLVED', 'REJECTED'])
    .optional(),
  customerId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getRmaSchema = z.object({
  id: z.string().uuid().optional(),
  rmaNumber: z.string().optional(),
});

export type RequestRmaInput = z.infer<typeof requestRmaSchema>;
export type ApproveRmaInput = z.infer<typeof approveRmaSchema>;
export type RejectRmaInput = z.infer<typeof rejectRmaSchema>;
export type ReceiveRmaInput = z.infer<typeof receiveRmaSchema>;
export type ResolveRmaInput = z.infer<typeof resolveRmaSchema>;
export type ListRmasInput = z.infer<typeof listRmasSchema>;
export type GetRmaInput = z.infer<typeof getRmaSchema>;
