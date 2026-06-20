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
import {
  PROCUREMENT_EVENTS,
  ProcurementService,
} from 'procurement';
import { WorkforceService } from 'workforce';
import { MesService } from 'mes';
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
    console.warn('Database unavailable for procurement integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('Procurement tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let vendorId: string;
  let productAId: string;
  let productBId: string;
  let reqAId: string;
  let reqBId: string;
  let binId: string;

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

    const vendor = await prisma.vendor.findFirstOrThrow({
      where: { deletedAt: null },
    });
    vendorId = vendor.id;

    const productA = await prisma.product.create({
      data: {
        sku: `PO-PROD-A-${testRun}`,
        description: 'Procurement test part A',
        unitOfMeasure: 'EA',
        procurementType: 'BUY',
        preferredVendorId: vendorId,
        listPrice: 10,
      },
    });
    const productB = await prisma.product.create({
      data: {
        sku: `PO-PROD-B-${testRun}`,
        description: 'Procurement test part B',
        unitOfMeasure: 'EA',
        procurementType: 'BUY',
        preferredVendorId: vendorId,
        listPrice: 5,
      },
    });
    productAId = productA.id;
    productBId = productB.id;

    const needBy = new Date('2026-08-15T00:00:00.000Z');
    const reqA = await prisma.purchaseRequisition.create({
      data: {
        reqNumber: `PR-TEST-A-${testRun}`,
        componentProductId: productAId,
        quantity: 100,
        needByDate: needBy,
        status: 'APPROVED',
        preferredVendorId: vendorId,
      },
    });
    const reqB = await prisma.purchaseRequisition.create({
      data: {
        reqNumber: `PR-TEST-B-${testRun}`,
        componentProductId: productBId,
        quantity: 50,
        needByDate: needBy,
        status: 'APPROVED',
        preferredVendorId: vendorId,
      },
    });
    reqAId = reqA.id;
    reqBId = reqB.id;

    const bin = await prisma.bin.findFirstOrThrow({ where: { active: true } });
    binId = bin.id;
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

  it('consolidates two approved requisitions into one PO', async () => {
    if (!databaseAvailable) return;

    const result = await adminCaller.procurement.createPurchaseOrders({
      requisitionIds: [reqAId, reqBId],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].lines).toHaveLength(2);
    expect(result.created[0].vendorId).toBe(vendorId);
    expect(result.skipped).toHaveLength(0);
  });

  it('issues, acknowledges, and submits ASN for PO', async () => {
    if (!databaseAvailable) return;

    const list = await adminCaller.procurement.listPurchaseOrders({});
    const po = list.items.find((p) => p.lines.some((l) => l.requisitionId === reqAId));
    expect(po).toBeDefined();

    publishedEvents.length = 0;

    const issued = await adminCaller.procurement.issuePurchaseOrder({
      purchaseOrderId: po!.id,
    });
    expect(issued.status).toBe('ISSUED');

    const acknowledged = await adminCaller.procurement.acknowledgePurchaseOrder({
      purchaseOrderId: po!.id,
      confirmedDeliveryDate: new Date('2026-08-14'),
      note: 'Confirmed by vendor rep',
    });
    expect(acknowledged.status).toBe('ACKNOWLEDGED');

    const withAsn = await adminCaller.procurement.submitAsn({
      purchaseOrderId: po!.id,
      expectedArrival: new Date('2026-08-13'),
      carrier: 'Test Freight',
      trackingNumber: 'TRK-123',
      lines: po!.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    });
    expect(withAsn.asns.length).toBeGreaterThan(0);

    expect(
      publishedEvents.some((e) => e.topic === PROCUREMENT_EVENTS.po.issued),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === PROCUREMENT_EVENTS.po.acknowledged),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === PROCUREMENT_EVENTS.asn.received),
    ).toBe(true);
  });

  it('receiveAgainstPo reconciles WMS on-hand and completes PO', async () => {
    if (!databaseAvailable) return;

    const po = await adminCaller.procurement.getPurchaseOrder({
      purchaseOrderId: (
        await adminCaller.procurement.listPurchaseOrders({})
      ).items.find((p) => p.lines.some((l) => l.requisitionId === reqAId))!.id,
    });

    const lineA = po.lines.find((l) => l.productId === productAId)!;
    const lineB = po.lines.find((l) => l.productId === productBId)!;

    const beforeA = await adminCaller.inventory.byProduct({
      productId: productAId,
    });

    const partial = await adminCaller.procurement.receiveAgainstPo({
      poLineId: lineA.id,
      quantity: 40,
      binId,
      receivedAt: new Date('2026-08-13'),
    });
    expect(partial.status).toBe('PARTIALLY_RECEIVED');

    await adminCaller.procurement.receiveAgainstPo({
      poLineId: lineA.id,
      quantity: 60,
      binId,
      receivedAt: new Date('2026-08-14'),
    });

    const full = await adminCaller.procurement.receiveAgainstPo({
      poLineId: lineB.id,
      quantity: 50,
      binId,
      receivedAt: new Date('2026-08-12'),
    });
    expect(full.status).toBe('RECEIVED');

    const afterA = await adminCaller.inventory.byProduct({
      productId: productAId,
    });
    expect(afterA.totals.onHand - beforeA.totals.onHand).toBeCloseTo(100, 2);
  });

  it('vendor scorecard reflects on-time and quantity accuracy', async () => {
    if (!databaseAvailable) return;

    const scorecard = await adminCaller.procurement.getVendorScorecard({
      vendorId,
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
    });

    const vendorMetrics = scorecard.vendors.find((v) => v.vendorId === vendorId);
    expect(vendorMetrics).toBeDefined();
    expect(vendorMetrics!.metrics.totalReceipts).toBeGreaterThan(0);
    expect(vendorMetrics!.metrics.onTimeRate).toBeGreaterThan(0);
    expect(vendorMetrics!.metrics.quantityAccuracyRate).toBe(1);
  });

  it('blocks Viewer from procurement write', async () => {
    if (!databaseAvailable) return;

    await expect(
      viewerCaller.procurement.issuePurchaseOrder({
        purchaseOrderId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
