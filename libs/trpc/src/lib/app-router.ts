import {
  CustomerService,
  ProductService,
  VendorService,
} from 'masterdata';
import { createCustomerRouter } from './routers/customer.router';
import { createProductRouter } from './routers/product.router';
import { createVendorRouter } from './routers/vendor.router';
import { router } from './trpc';

export interface AppRouterDependencies {
  productService: ProductService;
  customerService: CustomerService;
  vendorService: VendorService;
}

export function createAppRouter(deps: AppRouterDependencies) {
  return router({
    product: createProductRouter(deps.productService),
    customer: createCustomerRouter(deps.customerService),
    vendor: createVendorRouter(deps.vendorService),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
