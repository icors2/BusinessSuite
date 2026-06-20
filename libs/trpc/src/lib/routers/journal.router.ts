import { JournalService } from 'finance';
import {
  createJournalEntrySchema,
  idSchema,
  listJournalEntriesSchema,
} from 'finance';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createJournalRouter(journalService: JournalService) {
  return router({
    create: editorProcedure
      .input(createJournalEntrySchema)
      .mutation(({ ctx, input }) =>
        journalService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      journalService.getById(input.id),
    ),

    list: protectedProcedure.input(listJournalEntriesSchema).query(({ input }) =>
      journalService.list(input),
    ),

    post: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      journalService.post(input.id, ctx.user?.userId),
    ),

    reverse: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      journalService.reverse(input.id, ctx.user?.userId),
    ),
  });
}
