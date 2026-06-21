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
import { RETURNS_EVENTS, ReturnsService } from 'returns';
import { AdminService } from 'admin';
import { AnalyticsService } from 'analytics';
import { EVENT_BUS } from 'event-bus';
import { createAppRouter } from 'trpc';
import { AppModule } from './app.module';
import * as bcrypt from 'bcrypt';

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
    console.warn('Database unavailable for Returns integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

async function ensureSupportUsers(client: PrismaClient): Promise<void> {
  const supportRole = await client.role.upsert({
    where: { name: 'Support' },
    update: {},
    create: { name: 'Support' },
  });

  const hash = await bcrypt.hash('Support123!', 12);
  const support = await client.user.upsert({
    where: { email: 'support@arcncode.local' },
    update: { passwordHash: hash },
    create: {
      email: 'support@arcncode.local',
      passwordHash: hash,
    },
  });

  await client.userRole.upsert({
    where: {
      userId_roleId: { userId: support.id, roleId: supportRole.id },
    },
    update: {},
    create: { userId: support.id, roleId: supportRole.id },
  });
}

describe('Returns tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let supportCaller: ReturnType<
    ReturnType<typeof createAppRouter>['createCaller']
  >;
  let viewerCaller: ReturnType<
    ReturnType<typeof createAppRouter>['createCaller']
  >;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let shippedLineId: string;
  let returnsBinId: string;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });

    await ensureSupportUsers(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);

    const eventBus = app.get(EVENT_BUS);
    jest.spyOn(eventBus, 'publish').mockImplementation(async (topic, payload) => {
      publishedEvents.push({ topic: topic as string, payload });
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

    const mkCaller = (payload: JwtPayload) =>
      appRouter.createCaller({
        user: {
          userId: payload.sub,
          email: payload.email,
          roles: payload.roles,
        },
      });

    adminCaller = mkCaller(
      await login('admin@arcncode.local', 'Admin123!'),
    );
    supportCaller = mkCaller(
      await login('support@arcncode.local', 'Support123!'),
    );
    viewerCaller = mkCaller(
      await login('viewer@arcncode.local', 'Viewer123!'),
    );

    const location = await adminCaller.inventory.createLocation({
      code: `RETURNS-${testRun}`,
      name: 'Returns Warehouse',
      type: 'returns',
    });
    const bin = await adminCaller.inventory.createBin({
      locationId: location.id,
      code: `RET-${testRun}`,
    });
    returnsBinId = bin.id;

    await adminCaller.inventory.receive({
      sku: 'SKU-001',
      binCode: 'A-01-01',
      quantity: 200,
    });

    const customer = await prisma.customer.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'SKU-001' },
    });
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const quote = await adminCaller.quote.create({
      customerId: customer.id,
      validUntil,
    });
    await adminCaller.quote.addProductLine({
      quoteId: quote.id,
      productId: product.id,
      quantity: 5,
    });
    await adminCaller.quote.recalc({ quoteId: quote.id });
    await adminCaller.quote.transition({ quoteId: quote.id, action: 'send' });
    await adminCaller.quote.transition({ quoteId: quote.id, action: 'accept' });

    const order = await adminCaller.salesOrder.convert({
      quoteId: quote.id,
    });
    await adminCaller.salesOrder.allocate({ orderId: order.id });

    const line = order.lines.find((l) => l.kind === 'PRODUCT');
    if (!line) throw new Error('Expected PRODUCT line');

    const a01 = await prisma.bin.findUniqueOrThrow({
      where: { code: 'A-01-01' },
    });

    await adminCaller.salesOrder.confirmShipment({
      orderId: order.id,
      lines: [{ lineId: line.id, quantity: 3, binId: a01.id }],
    });

    shippedLineId = line.id;
  }, 60000);

  afterAll(async () => {
    if (!databaseAvailable) return;
    await app?.close();
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    publishedEvents.length = 0;
  });

  it('skips when database unavailable', () => {
    if (!databaseAvailable) {
      expect(databaseAvailable).toBe(false);
    }
  });

  it('blocks Viewer from requestRma', async () => {
    if (!databaseAvailable) return;

    await expect(
      viewerCaller.returns.requestRma({
        salesOrderLineId: shippedLineId,
        reasonCode: 'OTHER',
        quantity: 1,
      }),
    ).rejects.toThrow(/Support role or higher required/i);
  });

  it('requests RMA within return window and rejects outside window', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;
    const rma = await supportCaller.returns.requestRma({
      salesOrderLineId: shippedLineId,
      reasonCode: 'DEFECTIVE',
      quantity: 1,
      qualityRelated: true,
    });

    expect(rma.status).toBe('REQUESTED');
    expect(
      publishedEvents.some((e) => e.topic === RETURNS_EVENTS.rma.requested),
    ).toBe(true);

    const order = await prisma.salesOrderLine.findUniqueOrThrow({
      where: { id: shippedLineId },
      select: { orderId: true },
    });

    const shipment = await prisma.salesOrderShipment.findFirst({
      where: { orderId: order.orderId },
      orderBy: { shippedAt: 'desc' },
    });

    if (shipment) {
      const past = new Date();
      past.setUTCDate(past.getUTCDate() - 60);
      await prisma.salesOrderShipment.update({
        where: { id: shipment.id },
        data: { shippedAt: past },
      });
    }

    await expect(
      supportCaller.returns.requestRma({
        salesOrderLineId: shippedLineId,
        reasonCode: 'OTHER',
        quantity: 1,
      }),
    ).rejects.toThrow(/Return window/i);

    if (shipment) {
      await prisma.salesOrderShipment.update({
        where: { id: shipment.id },
        data: { shippedAt: new Date() },
      });
    }
  });

  it('receives return into WMS and creates QMS NC when quality-related', async () => {
    if (!databaseAvailable) return;

    const rma = await supportCaller.returns.requestRma({
      salesOrderLineId: shippedLineId,
      reasonCode: 'DEFECTIVE',
      quantity: 1,
      qualityRelated: true,
    });

    await supportCaller.returns.approveRma({ id: rma.id });

    const beforeInv = await prisma.inventoryQuantity.findFirst({
      where: {
        product: { sku: 'SKU-001' },
        binId: returnsBinId,
      },
    });
    const beforeOnHand = beforeInv ? Number(beforeInv.onHand) : 0;

    publishedEvents.length = 0;
    const received = await supportCaller.returns.receiveRma({
      id: rma.id,
      binId: returnsBinId,
    });

    expect(received.status).toBe('RECEIVED');
    expect(received.nonConformanceId).toBeTruthy();
    expect(
      publishedEvents.some((e) => e.topic === RETURNS_EVENTS.rma.received),
    ).toBe(true);

    const afterInv = await prisma.inventoryQuantity.findFirst({
      where: {
        product: { sku: 'SKU-001' },
        binId: returnsBinId,
      },
    });
    expect(Number(afterInv?.onHand ?? 0)).toBeGreaterThan(beforeOnHand);
  });

  it('resolves REFUND with credit memo', async () => {
    if (!databaseAvailable) return;

    const rma = await supportCaller.returns.requestRma({
      salesOrderLineId: shippedLineId,
      reasonCode: 'WRONG_ITEM',
      quantity: 1,
    });
    await supportCaller.returns.approveRma({ id: rma.id });
    await supportCaller.returns.receiveRma({
      id: rma.id,
      binId: returnsBinId,
    });

    publishedEvents.length = 0;
    const resolved = await supportCaller.returns.resolveRma({
      id: rma.id,
      resolutionType: 'REFUND',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.creditMemoId).toBeTruthy();
    expect(
      publishedEvents.some((e) => e.topic === RETURNS_EVENTS.rma.resolved),
    ).toBe(true);

    const creditMemo = await prisma.creditMemo.findUniqueOrThrow({
      where: { id: resolved.creditMemoId! },
    });
    expect(creditMemo.status).toBe('POSTED');
    expect(creditMemo.journalEntryId).toBeTruthy();
  });
});
