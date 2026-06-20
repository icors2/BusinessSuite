import { z } from 'zod';

export const upsertWorkstationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
});

export const listWorkstationsSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const upsertOperationSchema = z.object({
  workOrderId: z.string().uuid(),
  sequence: z.number().int().min(1),
  name: z.string().min(1),
  workstationId: z.string().uuid().optional(),
  standardMinutes: z.number().int().min(0).optional(),
});

export const generateOperationsSchema = z.object({
  workOrderId: z.string().uuid(),
  operations: z
    .array(
      z.object({
        name: z.string().min(1),
        workstationId: z.string().uuid().optional(),
        standardMinutes: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
});

export const listOperationsSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  workstationId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const startOperationSchema = z
  .object({
    operationId: z.string().uuid(),
    employeeId: z.string().uuid().optional(),
    badgeCode: z.string().optional(),
    startedAt: z.coerce.date().optional(),
  })
  .refine((d) => d.employeeId || d.badgeCode, {
    message: 'employeeId or badgeCode is required',
  });

export const stopOperationSchema = z.object({
  cycleId: z.string().uuid(),
  quantityCompleted: z.number().min(0),
  quantityScrapped: z.number().min(0).optional(),
  endedAt: z.coerce.date().optional(),
});

export const verifyWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
  notes: z.string().optional(),
  photoObjectKey: z.string().optional(),
  photoFileName: z.string().optional(),
  verifiedByEmployeeId: z.string().uuid().optional(),
});

export const getPlacardSchema = z.object({
  workOrderId: z.string().uuid(),
});

export const getDashboardSchema = z.object({
  workstationId: z.string().uuid().optional(),
});

export type UpsertWorkstationInput = z.infer<typeof upsertWorkstationSchema>;
export type ListWorkstationsInput = z.infer<typeof listWorkstationsSchema>;
export type UpsertOperationInput = z.infer<typeof upsertOperationSchema>;
export type GenerateOperationsInput = z.infer<typeof generateOperationsSchema>;
export type ListOperationsInput = z.infer<typeof listOperationsSchema>;
export type StartOperationInput = z.infer<typeof startOperationSchema>;
export type StopOperationInput = z.infer<typeof stopOperationSchema>;
export type VerifyWorkOrderInput = z.infer<typeof verifyWorkOrderSchema>;
export type GetPlacardInput = z.infer<typeof getPlacardSchema>;
export type GetDashboardInput = z.infer<typeof getDashboardSchema>;
