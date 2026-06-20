import { z } from 'zod';

export const runMrpSchema = z.object({});

export const listRequirementsSchema = z.object({
  workOrderId: z.string().uuid().optional(),
});

export const listRequisitionsSchema = z.object({
  status: z
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'CONVERTED'])
    .optional(),
  componentProductId: z.string().uuid().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getBomSchema = z.object({
  productId: z.string().uuid(),
});

export const bomLineInputSchema = z.object({
  componentProductId: z.string().uuid(),
  quantityPer: z.number().positive(),
  scrapFactor: z.number().min(0).optional(),
});

export const upsertBomSchema = z.object({
  productId: z.string().uuid(),
  active: z.boolean().optional(),
  lines: z.array(bomLineInputSchema).min(1),
});

export const reviewRequisitionSchema = z.object({
  requisitionId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT', 'ADJUST']),
  quantity: z.number().positive().optional(),
});

export type RunMrpInput = z.infer<typeof runMrpSchema>;
export type ListRequirementsInput = z.infer<typeof listRequirementsSchema>;
export type ListRequisitionsInput = z.infer<typeof listRequisitionsSchema>;
export type UpsertBomInput = z.infer<typeof upsertBomSchema>;
export type ReviewRequisitionInput = z.infer<typeof reviewRequisitionSchema>;
