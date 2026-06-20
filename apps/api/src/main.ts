import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import { loadAppConfig } from 'config';
import {
  CustomerService,
  ProductService,
  VendorService,
} from 'masterdata';
import {
  AccountService,
  BillService,
  InvoiceService,
  JournalService,
  PaymentService,
  ReportService,
} from 'finance';
import { DocumentService } from 'plm';
import { InventoryService, LocationService } from 'wms';
import { CpqCatalogService, QuoteService } from 'cpq';
import { SalesOrderService } from 'sales';
import { MpsService } from 'mps';
import { MrpService } from 'mrp';
import { ProcurementService } from 'procurement';
import { WorkforceService } from 'workforce';
import { MesService } from 'mes';
import { QmsService } from 'qms';
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
  const accountService = app.get(AccountService);
  const journalService = app.get(JournalService);
  const invoiceService = app.get(InvoiceService);
  const billService = app.get(BillService);
  const paymentService = app.get(PaymentService);
  const reportService = app.get(ReportService);
  const documentService = app.get(DocumentService);
  const inventoryService = app.get(InventoryService);
  const locationService = app.get(LocationService);
  const quoteService = app.get(QuoteService);
  const cpqCatalogService = app.get(CpqCatalogService);
  const salesOrderService = app.get(SalesOrderService);
  const mpsService = app.get(MpsService);
  const mrpService = app.get(MrpService);
  const procurementService = app.get(ProcurementService);
  const workforceService = app.get(WorkforceService);
  const mesService = app.get(MesService);
  const qmsService = app.get(QmsService);

  const appRouter = createAppRouter({
    productService,
    customerService,
    vendorService,
    accountService,
    journalService,
    invoiceService,
    billService,
    paymentService,
    reportService,
    documentService,
    inventoryService,
    locationService,
    quoteService,
    cpqCatalogService,
    salesOrderService,
    mpsService,
    mrpService,
    procurementService,
    workforceService,
    mesService,
    qmsService,
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
