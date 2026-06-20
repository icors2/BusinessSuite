import { z } from 'zod';

export const mpsStrategySchema = z.enum([
  'WEEKLY',
  'MONTHLY',
  'BUILD_TO_ORDER',
]);

export const previewDemandSchema = z.object({
  horizonStart: z.coerce.date().optional(),
  horizonEnd: z.coerce.date().optional(),
});

export const generateScheduleSchema = z.object({
  horizonStart: z.coerce.date().optional(),
  horizonEnd: z.coerce.date().optional(),
  replaceExisting: z.boolean().optional(),
});

export const listWorkOrdersSchema = z.object({
  status: z
    .enum([
      'PROPOSED',
      'FIRM',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional(),
  productId: z.string().uuid().optional(),
  periodKey: z.string().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
});

export const rescheduleWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
  lineId: z.string().uuid().optional(),
});

export const upsertLineSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  capacityPerDay: z.number().nonnegative(),
  active: z.boolean().optional(),
});

export const upsertCalendarDaySchema = z.object({
  date: z.coerce.date(),
  isWorkingDay: z.boolean(),
  notes: z.string().optional(),
});

export const getCalendarSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

export const setStrategySchema = z.object({
  scope: z.string().min(1),
  strategy: mpsStrategySchema,
});

export const setProductStrategySchema = z.object({
  productId: z.string().uuid(),
  strategy: mpsStrategySchema.nullable(),
});

export type PreviewDemandInput = z.infer<typeof previewDemandSchema>;
export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type ListWorkOrdersInput = z.infer<typeof listWorkOrdersSchema>;
export type RescheduleWorkOrderInput = z.infer<
  typeof rescheduleWorkOrderSchema
>;
export type UpsertLineInput = z.infer<typeof upsertLineSchema>;
export type UpsertCalendarDayInput = z.infer<typeof upsertCalendarDaySchema>;
export type GetCalendarInput = z.infer<typeof getCalendarSchema>;
export type SetStrategyInput = z.infer<typeof setStrategySchema>;
export type SetProductStrategyInput = z.infer<
  typeof setProductStrategySchema
>;
