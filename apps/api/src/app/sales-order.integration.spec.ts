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
import { SALES_EVENTS, SalesOrderService } from 'sales';
import { MpsService } from 'mps';
import { MrpService } from 'mrp';
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
    console.warn('Database unavailable for Sales integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('Sales Order tRPC Integration', () => {
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

    await adminCaller.inventory.receive({
      sku: 'SKU-001',
      binCode: 'A-01-01',
      quantity: 500,
    });
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  }, 30000);

  beforeEach(() => {
    publishedEvents.length = 0;
  });

  async function createAcceptedProductQuote(qty: number) {
    const customer = await prisma.customer.findFirstOrThrow({
      where: { name: 'Acme Manufacturing', deletedAt: null },
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
      quantity: qty,
    });

    await adminCaller.quote.recalc({ quoteId: quote.id });
    await adminCaller.quote.transition({ quoteId: quote.id, action: 'send' });
    await adminCaller.quote.transition({ quoteId: quote.id, action: 'accept' });

    return { quote, product, customer };
  }

  it('converts accepted quote to order with frozen pricing and full allocation', async () => {
    if (!databaseAvailable) return;

    const { quote, product } = await createAcceptedProductQuote(5);
    const quoteBefore = await adminCaller.quote.get({ quoteId: quote.id });
    const frozenUnitPrice = Number(quoteBefore.lines[0].unitPrice);

    const beforeInv = await adminCaller.inventory.byProduct({ sku: 'SKU-001' });
    const availableBefore = beforeInv.totals.available;

    const order = await adminCaller.salesOrder.convert({ quoteId: quote.id });

    expect(order.quoteId).toBe(quote.id);
    expect(order.lines.length).toBe(1);
    expect(order.lines[0].unitPrice).toBe(frozenUnitPrice);
    expect(order.lines[0].qtyAllocated).toBe(5);
    expect(order.lines[0].qtyBackordered).toBe(0);
    expect(['ALLOCATED', 'BACKORDERED']).toContain(order.status);

    const afterInv = await adminCaller.inventory.byProduct({ sku: 'SKU-001' });
    expect(afterInv.totals.available).toBe(availableBefore - 5);

    expect(
      publishedEvents.some((e) => e.topic === SALES_EVENTS.order.created),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === SALES_EVENTS.order.allocated),
    ).toBe(true);

    void product;
  });

  it('flags backorder when ordered qty exceeds available inventory', async () => {
    if (!databaseAvailable) return;

    const inv = await adminCaller.inventory.byProduct({ sku: 'SKU-001' });
    const orderQty = inv.totals.available + 100;
    const { quote } = await createAcceptedProductQuote(orderQty);

    const order = await adminCaller.salesOrder.convert({ quoteId: quote.id });

    expect(order.lines[0].qtyBackordered).toBeGreaterThan(0);
    expect(order.status).toBe('BACKORDERED');
    expect(
      publishedEvents.some((e) => e.topic === SALES_EVENTS.order.backordered),
    ).toBe(true);
  });

  it('confirmShipment creates posted invoice and reduces onHand for shipped qty', async () => {
    if (!databaseAvailable) return;

    await adminCaller.inventory.receive({
      sku: 'SKU-001',
      binCode: 'A-01-01',
      quantity: 50,
    });

    const { quote } = await createAcceptedProductQuote(3);
    const order = await adminCaller.salesOrder.convert({ quoteId: quote.id });
    const line = order.lines[0];

    expect(line.qtyAllocated).toBeGreaterThanOrEqual(3);

    const invLookup = await adminCaller.inventory.byProduct({ sku: 'SKU-001' });
    const binId =
      (line.allocationDetails as Array<{ binId: string }> | null)?.[0]?.binId ??
      invLookup.items.find((i) => i.allocated > 0)?.binId ??
      invLookup.items[0]?.binId;

    expect(binId).toBeTruthy();

    const beforeInv = await adminCaller.inventory.byProduct({ sku: 'SKU-001' });
    const onHandBefore = beforeInv.totals.onHand;

    const shipped = await adminCaller.salesOrder.confirmShipment({
      orderId: order.id,
      lines: [{ lineId: line.id, quantity: 2, binId }],
    });

    expect(shipped.lines[0].qtyShipped).toBe(2);
    expect(shipped.status).toBe('PARTIALLY_SHIPPED');
    expect(shipped.shipments.length).toBe(1);
    expect(shipped.shipments[0].invoiceId).toBeTruthy();

    const invoice = await adminCaller.invoice.get({
      id: shipped.shipments[0].invoiceId!,
    });
    expect(invoice.status).toBe('OPEN');
    expect(invoice.total).toBeCloseTo(line.unitPrice * 2, 2);

    const afterInv = await adminCaller.inventory.byProduct({ sku: 'SKU-001' });
    expect(afterInv.totals.onHand).toBe(onHandBefore - 2);

    expect(
      publishedEvents.some((e) => e.topic === SALES_EVENTS.order.shipped),
    ).toBe(true);
  });

  it('convert is idempotent for the same quote', async () => {
    if (!databaseAvailable) return;

    const { quote } = await createAcceptedProductQuote(2);
    const first = await adminCaller.salesOrder.convert({ quoteId: quote.id });
    const second = await adminCaller.salesOrder.convert({ quoteId: quote.id });

    expect(second.id).toBe(first.id);
    expect(second.orderNumber).toBe(first.orderNumber);
  });

  it('blocks Viewer from sales order writes', async () => {
    if (!databaseAvailable) return;

    const { quote } = await createAcceptedProductQuote(1);

    await expect(
      viewerCaller.salesOrder.convert({ quoteId: quote.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
