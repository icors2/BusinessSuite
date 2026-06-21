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
import { QmsService } from 'qms';
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
import { ALL_INGESTED_TOPICS, AnalyticsService } from 'analytics';
import { AdminService } from 'admin';
import { EVENT_BUS } from 'event-bus';
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
    console.warn('Database unavailable for Analytics integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('Analytics tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let analyticsService: AnalyticsService;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<
    ReturnType<typeof createAppRouter>['createCaller']
  >;

  const testRun = Date.now();

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);

    const eventBus = app.get(EVENT_BUS);
    jest.spyOn(eventBus, 'publish').mockImplementation(async () => 'mock-id');

    analyticsService = app.get(AnalyticsService);

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
      analyticsService,
      adminService: app.get(AdminService),
    });

    const login = async (email: string, password: string) => {
      const res = await import('supertest').then((m) =>
        m.default(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password }),
      );
      return jwt.decode(res.body.accessToken) as JwtPayload;
    };

    adminCaller = appRouter.createCaller({
      user: {
        userId: (await login('admin@arcncode.local', 'Admin123!')).sub,
        email: 'admin@arcncode.local',
        roles: ['Admin'],
      },
    });

    viewerCaller = appRouter.createCaller({
      user: {
        userId: (await login('viewer@arcncode.local', 'Viewer123!')).sub,
        email: 'viewer@arcncode.local',
        roles: ['Viewer'],
      },
    });
  }, 60000);

  afterAll(async () => {
    if (!databaseAvailable) return;
    await app?.close();
    await prisma?.$disconnect();
  });

  it('skips when database unavailable', () => {
    if (!databaseAvailable) {
      expect(databaseAvailable).toBe(false);
    }
  });

  it('ingests all topic families idempotently', async () => {
    if (!databaseAvailable) return;

    const ts = new Date().toISOString();
    for (const topic of ALL_INGESTED_TOPICS) {
      await analyticsService.recordEvent({
        topic,
        entityId: `test-${testRun}-${topic}`,
        actorId: 'test-actor',
        timestamp: ts,
        version: 1,
        payload: { test: true },
      });
      await analyticsService.recordEvent({
        topic,
        entityId: `test-${testRun}-${topic}`,
        actorId: 'test-actor',
        timestamp: ts,
        version: 1,
        payload: { test: true },
      });
    }

    const status = await adminCaller.analytics.getIngestionStatus();
    expect(status.complete).toBe(true);
    expect(status.missingTopics).toEqual([]);

    const count = await prisma.analyticsEvent.count({
      where: { entityId: { contains: `test-${testRun}` } },
    });
    expect(count).toBe(ALL_INGESTED_TOPICS.length);
  });

  it('detects deliberate WIP bottleneck', async () => {
    if (!databaseAvailable) return;

    const workstation = await prisma.workstation.findFirstOrThrow({
      where: { code: 'WS-LASER' },
    });

    const workOrders = await prisma.workOrder.findMany({ take: 5 });
    for (let i = 0; i < Math.min(5, workOrders.length); i++) {
      const wo = workOrders[i]!;
      await prisma.workOrderOperation.upsert({
        where: {
          workOrderId_sequence: { workOrderId: wo.id, sequence: 90 + i },
        },
        create: {
          workOrderId: wo.id,
          workstationId: workstation.id,
          sequence: 90 + i,
          name: `Analytics pileup ${i}`,
          status: 'IN_PROGRESS',
        },
        update: {
          workstationId: workstation.id,
          status: 'IN_PROGRESS',
        },
      });
    }

    const result = await adminCaller.analytics.getBottlenecks();
    const flagged = result.bottlenecks.find(
      (b) => b.workstationCode === workstation.code,
    );
    expect(flagged).toBeTruthy();
    expect(flagged!.wip).toBeGreaterThan(0);
  });

  it('computes inventory forecast directionally', async () => {
    if (!databaseAvailable) return;

    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'SKU-001' },
    });

    const asOf = new Date();
    asOf.setUTCHours(0, 0, 0, 0);

    await prisma.inventoryForecast.upsert({
      where: {
        productId_asOfDate: { productId: product.id, asOfDate: asOf },
      },
      create: {
        productId: product.id,
        asOfDate: asOf,
        avgDailyDemand: 2,
        onHand: 10,
        projectedDepletionDate: new Date(asOf.getTime() + 5 * 86400000),
        recommendedReorderDate: new Date(asOf.getTime() + 3 * 86400000),
        leadTimeDays: 2,
      },
      update: {
        avgDailyDemand: 2,
        onHand: 10,
        projectedDepletionDate: new Date(asOf.getTime() + 5 * 86400000),
        recommendedReorderDate: new Date(asOf.getTime() + 3 * 86400000),
      },
    });

    const forecasts = await adminCaller.analytics.getForecasts({
      sku: 'SKU-001',
    });
    const row = forecasts.items.find((f) => f.product.sku === 'SKU-001');
    expect(row).toBeTruthy();
    expect(row!.recommendedReorderDate).toBeTruthy();
    expect(row!.projectedDepletionDate).toBeTruthy();
    expect(
      row!.recommendedReorderDate!.getTime(),
    ).toBeLessThan(row!.projectedDepletionDate!.getTime());
  });

  it('answers NLQ scrap, bottleneck, and forecast questions', async () => {
    if (!databaseAvailable) return;

    const scrap = await viewerCaller.analytics.ask({
      question: 'what was our scrap rate last month',
    });
    expect(scrap.intent).toBe('scrapRate');
    expect(scrap.answer).toMatch(/scrap rate/i);

    const bottleneck = await viewerCaller.analytics.ask({
      question: 'where are the production bottlenecks',
    });
    expect(bottleneck.intent).toBe('bottleneck');

    const forecast = await viewerCaller.analytics.ask({
      question: 'show inventory forecast for SKU-001',
    });
    expect(forecast.intent).toBe('inventoryForecast');
    expect(forecast.answer).toMatch(/SKU-001/i);
  });

  it('allows Viewer reads but blocks recomputeForecasts', async () => {
    if (!databaseAvailable) return;

    await expect(viewerCaller.analytics.recomputeForecasts()).rejects.toThrow(
      /Admin or Manager role required/i,
    );

    const status = await viewerCaller.analytics.getIngestionStatus();
    expect(status.totalEvents).toBeGreaterThanOrEqual(0);
  });
});
