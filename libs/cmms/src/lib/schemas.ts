import { z } from 'zod';

export const upsertAssetSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  workstationId: z.string().uuid().optional().nullable(),
  status: z
    .enum(['OPERATIONAL', 'DOWN', 'MAINTENANCE', 'RETIRED'])
    .optional(),
});

export const listAssetsSchema = z.object({
  workstationId: z.string().uuid().optional(),
  status: z
    .enum(['OPERATIONAL', 'DOWN', 'MAINTENANCE', 'RETIRED'])
    .optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getAssetSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().optional(),
});

export const upsertPmRuleSchema = z.object({
  id: z.string().uuid().optional(),
  assetId: z.string().uuid(),
  type: z.enum(['CYCLE_COUNT', 'CALENDAR']),
  thresholdCycles: z.number().int().min(1).optional(),
  intervalDays: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
});

export const listPmRulesSchema = z.object({
  assetId: z.string().uuid().optional(),
  active: z.boolean().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const createMaintenanceWorkOrderSchema = z.object({
  assetId: z.string().uuid(),
  description: z.string().min(1),
  scheduledDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const listMaintenanceWorkOrdersSchema = z.object({
  assetId: z.string().uuid().optional(),
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .optional(),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE']).optional(),
  dueSoonOnly: z.boolean().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getMaintenanceWorkOrderSchema = z.object({
  id: z.string().uuid().optional(),
  mwoNumber: z.string().optional(),
});

export const startMaintenanceWorkOrderSchema = z.object({
  id: z.string().uuid(),
});

export const completeMaintenanceWorkOrderSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
});

export const cancelMaintenanceWorkOrderSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
});

export const getDueSoonSchema = z.object({
  take: z.number().int().min(1).max(100).optional(),
});

export const getMaintenanceHistoryForWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
  take: z.number().int().min(1).max(50).optional(),
});

export type UpsertAssetInput = z.infer<typeof upsertAssetSchema>;
export type ListAssetsInput = z.infer<typeof listAssetsSchema>;
export type GetAssetInput = z.infer<typeof getAssetSchema>;
export type UpsertPmRuleInput = z.infer<typeof upsertPmRuleSchema>;
export type ListPmRulesInput = z.infer<typeof listPmRulesSchema>;
export type CreateMaintenanceWorkOrderInput = z.infer<
  typeof createMaintenanceWorkOrderSchema
>;
export type ListMaintenanceWorkOrdersInput = z.infer<
  typeof listMaintenanceWorkOrdersSchema
>;
export type GetMaintenanceWorkOrderInput = z.infer<
  typeof getMaintenanceWorkOrderSchema
>;
export type StartMaintenanceWorkOrderInput = z.infer<
  typeof startMaintenanceWorkOrderSchema
>;
export type CompleteMaintenanceWorkOrderInput = z.infer<
  typeof completeMaintenanceWorkOrderSchema
>;
export type CancelMaintenanceWorkOrderInput = z.infer<
  typeof cancelMaintenanceWorkOrderSchema
>;
export type GetDueSoonInput = z.infer<typeof getDueSoonSchema>;
export type GetMaintenanceHistoryForWorkOrderInput = z.infer<
  typeof getMaintenanceHistoryForWorkOrderSchema
>;
