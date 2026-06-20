import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JwtPayload } from 'auth';
import {
  AccountService,
  BillService,
  InvoiceService,
  JournalService,
  PaymentService,
  ReportService,
} from 'finance';
import {
  CustomerService,
  ProductService,
  VendorService,
} from 'masterdata';
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
import { AnalyticsService } from 'analytics';
import { QmsService } from 'qms';
import { EVENT_BUS, EventBus } from 'event-bus';
import { createAppRouter } from 'trpc';
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
    console.warn('Database unavailable for WMS integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('WMS tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let eventBus: EventBus;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedTopics: string[] = [];

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    eventBus = app.get(EVENT_BUS);
    const originalPublish = eventBus.publish.bind(eventBus);
    jest.spyOn(eventBus, 'publish').mockImplementation(async (topic, payload) => {
      publishedTopics.push(topic);
      return originalPublish(topic, payload);
    });

    const appRouter = createAppRouter({
      productService: app.get(ProductService),
      customerService: app.get(CustomerService),
      vendorService: app.get(VendorService),
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
      analyticsService: app.get(AnalyticsService),
    });

    const adminLogin = await import('supertest').then((m) =>
      m.default(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@arcncode.local', password: 'Admin123!' }),
    );

    const viewerLogin = await import('supertest').then((m) =>
      m.default(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'viewer@arcncode.local', password: 'Viewer123!' }),
    );

    const adminPayload = jwt.decode(adminLogin.body.accessToken) as JwtPayload;
    const viewerPayload = jwt.decode(viewerLogin.body.accessToken) as JwtPayload;

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

  beforeEach(() => {
    publishedTopics.length = 0;
  });

  it('receives stock and increases on-hand', async () => {
    if (!databaseAvailable) return;

    const suffix = Date.now();
    const location = await adminCaller.inventory.createLocation({
      code: `WH-${suffix}`,
      name: 'Test Warehouse',
    });
    const bin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `BIN-${suffix}`,
    });

    const products = await adminCaller.product.list({ search: 'SKU-001' });
    const productId = products.items[0].id;

    const row = await adminCaller.inventory.receive({
      productId,
      binId: bin.id,
      quantity: 25,
    });

    expect(row.onHand).toBe(25);
    expect(row.available).toBe(25);
    expect(publishedTopics).toContain('wms.inventory.received');
  });

  it('moves stock between bins', async () => {
    if (!databaseAvailable) return;

    const suffix = Date.now();
    const location = await adminCaller.inventory.createLocation({
      code: `MV-${suffix}`,
      name: 'Move WH',
    });
    const fromBin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `FROM-${suffix}`,
    });
    const toBin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `TO-${suffix}`,
    });

    const products = await adminCaller.product.list({ search: 'SKU-002' });
    const productId = products.items[0].id;

    await adminCaller.inventory.receive({
      productId,
      binId: fromBin.id,
      quantity: 20,
    });

    const dest = await adminCaller.inventory.move({
      productId,
      fromBinId: fromBin.id,
      toBinId: toBin.id,
      quantity: 8,
    });

    expect(dest.onHand).toBe(8);

    const fromLookup = await adminCaller.inventory.byBin({ binId: fromBin.id });
    const fromRow = fromLookup.items.find((i) => i.productId === productId);
    expect(fromRow?.onHand).toBe(12);

    expect(publishedTopics).toContain('wms.inventory.moved');
  });

  it('allocate then pick respects available quantity', async () => {
    if (!databaseAvailable) return;

    const suffix = Date.now();
    const location = await adminCaller.inventory.createLocation({
      code: `PK-${suffix}`,
      name: 'Pick WH',
    });
    const bin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `PICK-${suffix}`,
    });

    const products = await adminCaller.product.list({ search: 'SKU-001' });
    const productId = products.items[0].id;

    await adminCaller.inventory.receive({
      productId,
      binId: bin.id,
      quantity: 10,
    });

    await adminCaller.inventory.allocate({
      productId,
      binId: bin.id,
      quantity: 5,
    });

    const afterAllocate = await adminCaller.inventory.byBin({ binId: bin.id });
    const allocatedRow = afterAllocate.items.find((i) => i.productId === productId);
    expect(allocatedRow?.available).toBe(5);

    await adminCaller.inventory.pick({
      productId,
      binId: bin.id,
      quantity: 3,
    });

    const afterPick = await adminCaller.inventory.byBin({ binId: bin.id });
    const pickedRow = afterPick.items.find((i) => i.productId === productId);
    expect(pickedRow?.onHand).toBe(7);
    expect(pickedRow?.available).toBe(2);

    await expect(
      adminCaller.inventory.pick({
        productId,
        binId: bin.id,
        quantity: 3,
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/exceeds available/i),
    });
  });

  it('allows negative pick with explicit override', async () => {
    if (!databaseAvailable) return;

    const suffix = Date.now();
    const location = await adminCaller.inventory.createLocation({
      code: `NG-${suffix}`,
      name: 'Negative WH',
    });
    const bin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `NEG-${suffix}`,
    });

    const products = await adminCaller.product.list({});
    const productId = products.items[0].id;

    await adminCaller.inventory.receive({
      productId,
      binId: bin.id,
      quantity: 5,
    });

    const row = await adminCaller.inventory.pick({
      productId,
      binId: bin.id,
      quantity: 6,
      allowNegative: true,
    });

    expect(row.onHand).toBe(-1);
  });

  it('adjusts inventory with reason code', async () => {
    if (!databaseAvailable) return;

    const suffix = Date.now();
    const location = await adminCaller.inventory.createLocation({
      code: `ADJ-${suffix}`,
      name: 'Adjust WH',
    });
    const bin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `ADJBIN-${suffix}`,
    });

    const products = await adminCaller.product.list({});
    const productId = products.items[0].id;

    await adminCaller.inventory.receive({
      productId,
      binId: bin.id,
      quantity: 10,
    });

    const row = await adminCaller.inventory.adjust({
      productId,
      binId: bin.id,
      quantityDelta: -2,
      reasonCode: 'CYCLE_COUNT',
    });

    expect(row.onHand).toBe(8);
    expect(publishedTopics).toContain('wms.inventory.adjusted');
  });

  it('blocks Viewer from inventory writes', async () => {
    if (!databaseAvailable) return;

    const bins = await viewerCaller.inventory.listBins({});
    const products = await viewerCaller.product.list({});

    await expect(
      viewerCaller.inventory.receive({
        productId: products.items[0].id,
        binId: bins.items[0]?.id ?? '00000000-0000-0000-0000-000000000000',
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

