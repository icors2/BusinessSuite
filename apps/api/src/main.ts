import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import { loadAppConfig } from 'config';
import {
  CustomerService,
  ProductService,
  VendorService,
} from 'masterdata';
import { createAppRouter, createContextFromRequest } from 'trpc';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const productService = app.get(ProductService);
  const customerService = app.get(CustomerService);
  const vendorService = app.get(VendorService);

  const appRouter = createAppRouter({
    productService,
    customerService,
    vendorService,
  });

  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }) => createContextFromRequest(req, config),
    }),
  );

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  Logger.log(
    `Application is running on: http://${host}:${port}/${globalPrefix}`,
  );
  Logger.log(`tRPC endpoint: http://${host}:${port}/trpc`);
}

bootstrap();
