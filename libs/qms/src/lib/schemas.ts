import { z } from 'zod';

export const upsertTemplateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  productId: z.string().uuid().optional(),
  operationName: z.string().optional(),
  active: z.boolean().optional(),
});

export const listTemplatesSchema = z.object({
  productId: z.string().uuid().optional(),
  active: z.boolean().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().optional(),
});

export const addCriterionSchema = z.object({
  templateId: z.string().uuid(),
  sequence: z.number().int().min(1),
  label: z.string().min(1),
  type: z.enum(['PASS_FAIL', 'MEASUREMENT']),
  expectedMin: z.number().optional(),
  expectedMax: z.number().optional(),
  unit: z.string().optional(),
});

export const criterionResultInputSchema = z.object({
  criterionId: z.string().uuid(),
  passed: z.boolean().optional(),
  measuredValue: z.number().optional(),
  photoObjectKey: z.string().optional(),
  photoFileName: z.string().optional(),
  notes: z.string().optional(),
});

export const completeInspectionSchema = z.object({
  templateId: z.string().uuid(),
  workOrderId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  inspectorEmployeeId: z.string().uuid().optional(),
  notes: z.string().optional(),
  results: z.array(criterionResultInputSchema).min(1),
});

export const raiseNonConformanceSchema = z.object({
  description: z.string().min(1),
  severity: z.enum(['MINOR', 'MAJOR', 'HOLD']),
  inspectionId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  binId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  quantityScrapped: z.number().min(0).optional(),
});

export const reportScrapSchema = z.object({
  description: z.string().min(1),
  severity: z.enum(['MINOR', 'MAJOR', 'HOLD']),
  workOrderId: z.string().uuid().optional(),
  binId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  quantityScrapped: z.number().min(0),
});

export const dispositionSchema = z.object({
  nonConformanceId: z.string().uuid(),
  disposition: z.enum([
    'USE_AS_IS',
    'REWORK',
    'SCRAP',
    'RETURN_TO_VENDOR',
  ]),
  notes: z.string().optional(),
});

export const listInspectionsSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getInspectionSchema = z.object({
  id: z.string().uuid(),
});

export const listNonConformancesSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']).optional(),
  workOrderId: z.string().uuid().optional(),
  holdActive: z.boolean().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const getNonConformanceSchema = z.object({
  id: z.string().uuid(),
});

export type UpsertTemplateInput = z.infer<typeof upsertTemplateSchema>;
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;
export type GetTemplateInput = z.infer<typeof getTemplateSchema>;
export type AddCriterionInput = z.infer<typeof addCriterionSchema>;
export type CompleteInspectionInput = z.infer<typeof completeInspectionSchema>;
export type RaiseNonConformanceInput = z.infer<typeof raiseNonConformanceSchema>;
export type ReportScrapInput = z.infer<typeof reportScrapSchema>;
export type DispositionInput = z.infer<typeof dispositionSchema>;
export type ListInspectionsInput = z.infer<typeof listInspectionsSchema>;
export type GetInspectionInput = z.infer<typeof getInspectionSchema>;
export type ListNonConformancesInput = z.infer<typeof listNonConformancesSchema>;
export type GetNonConformanceInput = z.infer<typeof getNonConformanceSchema>;
