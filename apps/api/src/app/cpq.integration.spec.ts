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
import { CpqCatalogService, CPQ_EVENTS, QuoteService } from 'cpq';
import { SalesOrderService } from 'sales';
import { MpsService } from 'mps';
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
    console.warn('Database unavailable for CPQ integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('CPQ tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let eventBus: EventBus;
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

    await prisma.cpqMaterial.upsert({
      where: { itemNumber: 'S-P0063-3003' },
      update: {},
      create: {
        itemNumber: 'S-P0063-3003',
        description: 'Plate 1/4 3003 (seed test)',
        standardCost: 2.5,
        uom: 1,
        uomProcess: 4018,
        cutSpeedInMin: 120,
        pierceTimeSecs: 2,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    eventBus = app.get(EVENT_BUS);
    const originalPublish = eventBus.publish.bind(eventBus);
    jest.spyOn(eventBus, 'publish').mockImplementation(async (topic, payload) => {
      publishedEvents.push({ topic, payload });
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
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  }, 30000);

  beforeEach(() => {
    publishedEvents.length = 0;
  });

  it('builds quote with product + fabricated lines, freezes snapshot on send, accepts', async () => {
    if (!databaseAvailable) return;

    const customer = await prisma.customer.findFirstOrThrow({
      where: { name: 'Acme Manufacturing', deletedAt: null },
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { priceTier: 'preferred' },
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'SKU-001' },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { listPrice: 100 },
    });

    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const quote = await adminCaller.quote.create({
      customerId: customer.id,
      validUntil,
      notes: 'CPQ integration test',
    });

    expect(quote.status).toBe('DRAFT');
    expect(publishedEvents.some((e) => e.topic === CPQ_EVENTS.quote.created)).toBe(
      true,
    );

    await adminCaller.quote.addProductLine({
      quoteId: quote.id,
      productId: product.id,
      quantity: 5,
    });

    await adminCaller.quote.addFabricatedLine({
      quoteId: quote.id,
      description: 'Base plate bracket',
      quantity: 2,
      fabInput: {
        kind: 'plate',
        name: 'Base plate',
        material: 'S-P0063-3003',
        length: 10,
        width: 6,
        drillFeatures: 2,
      },
    });

    const recalculated = await adminCaller.quote.recalc({ quoteId: quote.id });
    expect(recalculated.lines.length).toBe(2);
    expect(Number(recalculated.total)).toBeGreaterThan(0);

    const sent = await adminCaller.quote.transition({
      quoteId: quote.id,
      action: 'send',
    });

    expect(sent.status).toBe('SENT');
    expect(sent.pricingSnapshot).toBeTruthy();
    const snapshotTotal = (sent.pricingSnapshot as { totals: { total: number } })
      .totals.total;

    await prisma.product.update({
      where: { id: product.id },
      data: { listPrice: 9999 },
    });
    await adminCaller.cpqCatalog.updateRateCard({ laborMargin: 0.99 });

    const afterMutation = await adminCaller.quote.get({ quoteId: quote.id });
    expect(Number(afterMutation.total)).toBe(snapshotTotal);
    expect(
      (afterMutation.pricingSnapshot as { totals: { total: number } }).totals
        .total,
    ).toBe(snapshotTotal);

    const accepted = await adminCaller.quote.transition({
      quoteId: quote.id,
      action: 'accept',
    });

    expect(accepted.status).toBe('ACCEPTED');
    const acceptEvent = publishedEvents.find(
      (e) => e.topic === CPQ_EVENTS.quote.accepted,
    );
    expect(acceptEvent).toBeDefined();
    const payload = acceptEvent!.payload as {
      payload: {
        quoteId: string;
        customerId: string;
        lines: Array<{ kind: string; quantity: number }>;
      };
    };
    expect(payload.payload.quoteId).toBe(quote.id);
    expect(payload.payload.customerId).toBe(customer.id);
    expect(payload.payload.lines.length).toBe(2);
  });

  it('rejects accepting an expired quote', async () => {
    if (!databaseAvailable) return;

    const customer = await prisma.customer.findFirstOrThrow({
      where: { name: 'Acme Manufacturing', deletedAt: null },
    });

    const quote = await adminCaller.quote.create({
      customerId: customer.id,
      validUntil: new Date('2020-01-01'),
    });

    await adminCaller.quote.transition({ quoteId: quote.id, action: 'send' });

    await expect(
      adminCaller.quote.transition({ quoteId: quote.id, action: 'accept' }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/expired/i),
    });

    const expired = await adminCaller.quote.get({ quoteId: quote.id });
    expect(expired.status).toBe('EXPIRED');
  });

  it('blocks Viewer from quote writes', async () => {
    if (!databaseAvailable) return;

    const customers = await viewerCaller.customer.list({});
    await expect(
      viewerCaller.quote.create({ customerId: customers.items[0].id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

