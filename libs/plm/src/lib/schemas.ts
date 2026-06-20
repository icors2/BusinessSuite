import { z } from 'zod';

export const documentStatusSchema = z.enum([
  'DRAFT',
  'IN_REVIEW',
  'RELEASED',
  'OBSOLETE',
]);

export const createDocumentSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1),
  docType: z.string().optional(),
});

export const listDocumentsByProductSchema = z.object({
  productId: z.string().uuid(),
  search: z.string().optional(),
  skip: z.number().int().min(0).optional().default(0),
  take: z.number().int().min(1).max(100).optional().default(50),
});

export const documentIdSchema = z.object({
  documentId: z.string().uuid(),
});

export const revisionIdSchema = z.object({
  revisionId: z.string().uuid(),
});

export const transitionStatusSchema = z.object({
  revisionId: z.string().uuid(),
  targetStatus: documentStatusSchema,
});

export const addRevisionMetaSchema = z.object({
  revisionId: z.string().uuid().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  objectKey: z.string().min(1),
  notes: z.string().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type ListDocumentsByProductInput = z.infer<
  typeof listDocumentsByProductSchema
>;
export type AddRevisionMetaInput = z.infer<typeof addRevisionMetaSchema>;
export type DocumentStatusValue = z.infer<typeof documentStatusSchema>;
