import { VendorService } from 'masterdata';
import {
  createVendorSchema,
  idSchema,
  listVendorsSchema,
  updateVendorSchema,
} from 'masterdata';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createVendorRouter(vendorService: VendorService) {
  return router({
    create: editorProcedure
      .input(createVendorSchema)
      .mutation(({ ctx, input }) =>
        vendorService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      vendorService.getById(input.id),
    ),

    list: protectedProcedure.input(listVendorsSchema).query(({ input }) =>
      vendorService.list(input),
    ),

    update: editorProcedure
      .input(idSchema.merge(updateVendorSchema))
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return vendorService.update(id, data, ctx.user?.userId);
      }),

    deactivate: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      vendorService.deactivate(input.id, ctx.user?.userId),
    ),
  });
}
