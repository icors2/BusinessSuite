import { DocumentService } from 'plm';
import {
  createDocumentSchema,
  documentIdSchema,
  listDocumentsByProductSchema,
  transitionStatusSchema,
} from 'plm';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createDocumentRouter(documentService: DocumentService) {
  return router({
    create: editorProcedure
      .input(createDocumentSchema)
      .mutation(({ ctx, input }) =>
        documentService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(documentIdSchema).query(({ input }) =>
      documentService.getById(input.documentId),
    ),

    listByProduct: protectedProcedure
      .input(listDocumentsByProductSchema)
      .query(({ input }) => documentService.listByProduct(input)),

    revisions: protectedProcedure.input(documentIdSchema).query(({ input }) =>
      documentService.getRevisions(input.documentId),
    ),

    transition: editorProcedure
      .input(transitionStatusSchema)
      .mutation(({ ctx, input }) =>
        documentService.transitionStatus(
          input.revisionId,
          input.targetStatus,
          ctx.user?.userId,
        ),
      ),
  });
}
