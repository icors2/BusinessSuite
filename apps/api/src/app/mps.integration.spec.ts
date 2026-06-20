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
import { MPS_EVENTS, MpsService } from 'mps';
import { MrpService } from 'mrp';
import { ProcurementService } from 'procurement';
import { WorkforceService } from 'workforce';
import { MesService } from 'mes';
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
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
    console.warn('Database unavailable for MPS integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('MPS tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];

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

    const eventBus = app.get(EVENT_BUS);
    const originalPublish = eventBus.publish.bind(eventBus);
    jest.spyOn(eventBus, 'publish').mockImplementation(async (topic, payload) => {
      publishedEvents.push({ topic: topic as string, payload });
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

    const line = await adminCaller.mps.upsertLine({
      code: 'MPS-TEST-LINE',
      name: 'MPS Test Line',
      capacityPerDay: 5,
      active: true,
    });

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const day = date.getUTCDay();
      await adminCaller.mps.upsertCalendarDay({
        date,
        isWorkingDay: day !== 0 && day !== 6,
      });
    }

    await adminCaller.mps.setStrategy({
      scope: 'GLOBAL',
      strategy: 'WEEKLY',
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'SKU-001' },
    });
    await adminCaller.mps.setProductStrategy({
      productId: product.id,
      strategy: 'WEEKLY',
    });

    void line;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('skips database tests when unavailable', () => {
    if (!databaseAvailable) {
      expect(true).toBe(true);
    }
  });

  it('previewDemand returns net buckets from open sales demand', async () => {
    if (!databaseAvailable) return;

    const preview = await adminCaller.mps.previewDemand({});
    expect(preview.grossBuckets.length).toBeGreaterThan(0);
    expect(preview.summary.grossLines).toBeGreaterThan(0);
  });

  it('weekly vs BTO strategies produce distinct scheduling output', async () => {
    if (!databaseAvailable) return;

    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'SKU-001' },
    });
    const customer = await prisma.customer.findFirstOrThrow();
    const shipDate = new Date();
    shipDate.setUTCDate(shipDate.getUTCDate() + 10);

    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-MPS-STRAT-${Date.now()}`,
        customerId: customer.id,
        status: 'ALLOCATED',
        requestedShipDate: shipDate,
        subtotal: 100,
        total: 100,
        lines: {
          create: [
            {
              lineNumber: 1,
              kind: 'PRODUCT',
              productId: product.id,
              description: 'Strategy comparison demand',
              unitPrice: 10,
              qtyOrdered: 10,
              lineTotal: 100,
            },
            {
              lineNumber: 2,
              kind: 'PRODUCT',
              productId: product.id,
              description: 'Second line for BTO',
              unitPrice: 10,
              qtyOrdered: 5,
              lineTotal: 50,
            },
          ],
        },
      },
    });

    const horizonStart = new Date();
    horizonStart.setUTCHours(0, 0, 0, 0);
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + 2);

    await adminCaller.mps.setProductStrategy({
      productId: product.id,
      strategy: 'WEEKLY',
    });
    const weeklyPreview = await adminCaller.mps.previewDemand({
      horizonStart,
      horizonEnd,
    });
    const weekly = await adminCaller.mps.generateSchedule({
      horizonStart,
      horizonEnd,
      replaceExisting: true,
    });

    await adminCaller.mps.setProductStrategy({
      productId: product.id,
      strategy: 'BUILD_TO_ORDER',
    });
    const btoPreview = await adminCaller.mps.previewDemand({
      horizonStart,
      horizonEnd,
    });
    const bto = await adminCaller.mps.generateSchedule({
      horizonStart,
      horizonEnd,
      replaceExisting: true,
    });

    expect(weeklyPreview.grossBuckets.length).toBeGreaterThan(0);
    expect(btoPreview.grossBuckets.length).toBeGreaterThan(
      weeklyPreview.grossBuckets.length,
    );
    expect(weekly.created.length).toBeGreaterThan(0);
    expect(bto.created.length).toBeGreaterThan(weekly.created.length);
    const weeklyKeys = new Set(weekly.created.map((w) => w.periodKey));
    const btoKeys = new Set(bto.created.map((w) => w.periodKey));
    expect([...weeklyKeys].some((k) => !k.startsWith('BTO:'))).toBe(true);
    expect([...btoKeys].some((k) => k.startsWith('BTO:'))).toBe(true);
  });

  it('flags overload when demand exceeds line capacity', async () => {
    if (!databaseAvailable) return;

    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'SKU-001' },
    });
    const customer = await prisma.customer.findFirstOrThrow();

    await adminCaller.mps.setProductStrategy({
      productId: product.id,
      strategy: 'WEEKLY',
    });

    await adminCaller.mps.upsertLine({
      code: 'MPS-TEST-LINE',
      name: 'MPS Test Line',
      capacityPerDay: 1,
      active: true,
    });

    const shipDate = new Date();
    shipDate.setUTCDate(shipDate.getUTCDate() + 14);

    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-MPS-OVER-${Date.now()}`,
        customerId: customer.id,
        status: 'ALLOCATED',
        requestedShipDate: shipDate,
        subtotal: 5000,
        total: 5000,
        lines: {
          create: [
            {
              lineNumber: 1,
              kind: 'PRODUCT',
              productId: product.id,
              description: 'MPS overload test demand',
              unitPrice: 10,
              qtyOrdered: 500,
              lineTotal: 5000,
            },
          ],
        },
      },
    });

    const horizonStart = new Date();
    horizonStart.setUTCHours(0, 0, 0, 0);
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + 2);

    publishedEvents.length = 0;
    const result = await adminCaller.mps.generateSchedule({
      horizonStart,
      horizonEnd,
      replaceExisting: true,
    });

    expect(result.overloads.length).toBeGreaterThan(0);
    expect(
      publishedEvents.some((e) => e.topic === MPS_EVENTS.capacity.overloaded),
    ).toBe(true);
  });

  it('reschedule moves work order dates', async () => {
    if (!databaseAvailable) return;

    const list = await adminCaller.mps.listWorkOrders({ take: 1 });
    expect(list.items.length).toBeGreaterThan(0);
    const wo = list.items[0];

    const newStart = new Date(wo.scheduledStart);
    newStart.setUTCDate(newStart.getUTCDate() + 7);
    const newEnd = new Date(wo.scheduledEnd);
    newEnd.setUTCDate(newEnd.getUTCDate() + 7);

    publishedEvents.length = 0;
    const updated = await adminCaller.mps.rescheduleWorkOrder({
      workOrderId: wo.id,
      scheduledStart: newStart,
      scheduledEnd: newEnd,
    });

    expect(updated.scheduledStart.getTime()).toBe(newStart.getTime());
    expect(
      publishedEvents.some((e) => e.topic === MPS_EVENTS.workorder.rescheduled),
    ).toBe(true);
  });

  it('blocks Viewer from generateSchedule', async () => {
    if (!databaseAvailable) return;

    await expect(
      viewerCaller.mps.generateSchedule({ replaceExisting: false }),
    ).rejects.toThrow();
  });
});

