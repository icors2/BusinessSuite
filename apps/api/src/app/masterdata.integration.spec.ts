import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JwtPayload } from 'auth';
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
import { createAppRouter } from 'trpc';
import { DocumentService } from 'plm';
import { InventoryService, LocationService } from 'wms';
import { CpqCatalogService, QuoteService } from 'cpq';
import { SalesOrderService } from 'sales';
import { MpsService } from 'mps';
import { MrpService } from 'mrp';
import { ProcurementService } from 'procurement';
import { WorkforceService } from 'workforce';
import { MesService } from 'mes';
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
import { QmsService } from 'qms';
import { AppModule } from './app.module';

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://anc:anc@localhost:5432/anc_suite?schema=public';

async function isDatabaseAvailable(): Promise<boolean> {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.warn('Database unavailable for integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('Masterdata tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) {
      console.warn('Skipping masterdata integration tests: database unavailable');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const productService = app.get(ProductService);
    const customerService = app.get(CustomerService);
    const vendorService = app.get(VendorService);

    const appRouter = createAppRouter({
      productService,
      customerService,
      vendorService,
      accountService: app.get(AccountService),
      journalService: app.get(JournalService),
      invoiceService: app.get(InvoiceService),
      billService: app.get(BillService),
      paymentService: app.get(PaymentService),
      reportService: app.get(ReportService),
      documentService: app.get(DocumentService),
      inventoryService: app.get(InventoryService),
      locationService: app.get(LocationService),
      quoteService: app.get(QuoteService),
      cpqCatalogService: app.get(CpqCatalogService),
      salesOrderService: app.get(SalesOrderService),
      mpsService: app.get(MpsService),
      mrpService: app.get(MrpService),
      procurementService: app.get(ProcurementService),
      workforceService: app.get(WorkforceService),
      mesService: app.get(MesService),
      qmsService: app.get(QmsService),
      cmmsService: app.get(CmmsService),
      returnsService: app.get(ReturnsService),
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@arcncode.local', password: 'Admin123!' });

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'viewer@arcncode.local', password: 'Viewer123!' });

    const adminPayload = jwt.decode(
      adminLogin.body.accessToken,
    ) as JwtPayload;
    const viewerPayload = jwt.decode(
      viewerLogin.body.accessToken,
    ) as JwtPayload;

    adminCaller = appRouter.createCaller({
      user: {
        userId: adminPayload.sub,
        email: adminPayload.email,
        roles: adminPayload.roles,
      },
    });

    viewerCaller = appRouter.createCaller({
      user: {
        userId: viewerPayload.sub,
        email: viewerPayload.email,
        roles: viewerPayload.roles,
      },
    });
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  it('creates, lists, updates, and deactivates a product', async () => {
    if (!databaseAvailable) return;

    const sku = `TEST-SKU-${Date.now()}`;
    const created = await adminCaller.product.create({
      sku,
      description: 'Integration Test Product',
      unitOfMeasure: 'EA',
      category: 'Test',
    });

    expect(created.sku).toBe(sku);

    const listed = await adminCaller.product.list({ search: sku });
    expect(listed.items.some((p) => p.id === created.id)).toBe(true);

    const updated = await adminCaller.product.update({
      id: created.id,
      description: 'Updated Description',
    });
    expect(updated.description).toBe('Updated Description');

    const deactivated = await adminCaller.product.deactivate({ id: created.id });
    expect(deactivated.active).toBe(false);
  });

  it('blocks viewer from creating products but allows read', async () => {
    if (!databaseAvailable) return;

    const list = await viewerCaller.product.list({});
    expect(Array.isArray(list.items)).toBe(true);

    await expect(
      viewerCaller.product.create({
        sku: `VIEWER-SKU-${Date.now()}`,
        description: 'Should fail',
        unitOfMeasure: 'EA',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('creates and deactivates customer and vendor', async () => {
    if (!databaseAvailable) return;

    const customer = await adminCaller.customer.create({
      name: `Test Customer ${Date.now()}`,
      billingAddress: {
        line1: '1 Test Lane',
        city: 'Testville',
        state: 'TX',
        postalCode: '75001',
        country: 'US',
      },
    });
    expect(customer.id).toBeDefined();

    const vendor = await adminCaller.vendor.create({
      name: `Test Vendor ${Date.now()}`,
      paymentTerms: 'Net 30',
    });
    expect(vendor.id).toBeDefined();

    await adminCaller.customer.deactivate({ id: customer.id });
    await adminCaller.vendor.deactivate({ id: vendor.id });
  });
});

