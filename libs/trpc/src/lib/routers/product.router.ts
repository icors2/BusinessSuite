import { ProductService } from 'masterdata';
import {
  createProductSchema,
  idSchema,
  listProductsSchema,
  updateProductSchema,
} from 'masterdata';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createProductRouter(productService: ProductService) {
  return router({
    create: editorProcedure
      .input(createProductSchema)
      .mutation(({ ctx, input }) =>
        productService.create(input, ctx.user?.userId),
      ),

    get: protectedProcedure.input(idSchema).query(({ input }) =>
      productService.getById(input.id),
    ),

    list: protectedProcedure.input(listProductsSchema).query(({ input }) =>
      productService.list(input),
    ),

    update: editorProcedure
      .input(idSchema.merge(updateProductSchema))
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return productService.update(id, data, ctx.user?.userId);
      }),

    deactivate: editorProcedure.input(idSchema).mutation(({ ctx, input }) =>
      productService.deactivate(input.id, ctx.user?.userId),
    ),
  });
}
