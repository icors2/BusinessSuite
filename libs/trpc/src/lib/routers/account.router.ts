import { AccountService } from 'finance';
import {
  createAccountSchema,
  idSchema,
  listAccountsSchema,
  updateAccountSchema,
} from 'finance';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createAccountRouter(accountService: AccountService) {
  return router({
    create: editorProcedure
      .input(createAccountSchema)
      .mutation(({ ctx, input }) =>
        accountService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      accountService.getById(input.id),
    ),

    list: protectedProcedure.input(listAccountsSchema).query(({ input }) =>
      accountService.list(input),
    ),

    update: editorProcedure
      .input(idSchema.merge(updateAccountSchema))
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return accountService.update(id, data, ctx.user?.userId);
      }),

    deactivate: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      accountService.deactivate(input.id, ctx.user?.userId),
    ),
  });
}
