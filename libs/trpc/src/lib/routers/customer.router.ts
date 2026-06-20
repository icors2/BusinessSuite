import { CustomerService } from 'masterdata';
import {
  createCustomerSchema,
  idSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from 'masterdata';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createCustomerRouter(customerService: CustomerService) {
  return router({
    create: editorProcedure
      .input(createCustomerSchema)
      .mutation(({ ctx, input }) =>
        customerService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      customerService.getById(input.id),
    ),

    list: protectedProcedure.input(listCustomersSchema).query(({ input }) =>
      customerService.list(input),
    ),

    update: editorProcedure
      .input(idSchema.merge(updateCustomerSchema))
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return customerService.update(id, data, ctx.user?.userId);
      }),

    deactivate: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      customerService.deactivate(input.id, ctx.user?.userId),
    ),
  });
}
