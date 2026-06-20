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
import { MRP_EVENTS, MrpService } from 'mrp';
import { ProcurementService } from 'procurement';
import { WorkforceService } from 'workforce';
import { MesService } from 'mes';
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
    console.warn('Database unavailable for MRP integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('MRP tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let assemblyId: string;
  let subAsmId: string;
  let buyPartId: string;
  let buyBoltId: string;
  let lineId: string;
  let woId: string;
  let woStart: Date;

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
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { leadTimeDays: 5 },
    });

    const assembly = await prisma.product.create({
      data: {
        sku: `MRP-ASM-${testRun}`,
        description: 'MRP test assembly',
        unitOfMeasure: 'EA',
        procurementType: 'MAKE',
      },
    });
    const subAsm = await prisma.product.create({
      data: {
        sku: `MRP-SUB-${testRun}`,
        description: 'MRP test sub-assembly',
        unitOfMeasure: 'EA',
        procurementType: 'MAKE',
      },
    });
    const buyPart = await prisma.product.create({
      data: {
        sku: `MRP-BUY-${testRun}`,
        description: 'MRP test buy part',
        unitOfMeasure: 'EA',
        procurementType: 'BUY',
        leadTimeDays: 7,
        preferredVendorId: vendor.id,
      },
    });
    const buyBolt = await prisma.product.create({
      data: {
        sku: `MRP-BOLT-${testRun}`,
        description: 'MRP test bolt',
        unitOfMeasure: 'EA',
        procurementType: 'BUY',
        leadTimeDays: 3,
      },
    });

    assemblyId = assembly.id;
    subAsmId = subAsm.id;
    buyPartId = buyPart.id;
    buyBoltId = buyBolt.id;

    await adminCaller.mrp.upsertBom({
      productId: subAsmId,
      lines: [
        {
          componentProductId: buyPartId,
          quantityPer: 2,
          scrapFactor: 0.05,
        },
      ],
    });

    await adminCaller.mrp.upsertBom({
      productId: assemblyId,
      lines: [
        { componentProductId: subAsmId, quantityPer: 1, scrapFactor: 0 },
        {
          componentProductId: buyBoltId,
          quantityPer: 4,
          scrapFactor: 0.1,
        },
      ],
    });

    const line = await adminCaller.mps.upsertLine({
      code: `MRP-LINE-${testRun}`,
      name: 'MRP Test Line',
      capacityPerDay: 100,
      active: true,
    });
    lineId = line.id;

    woStart = new Date('2026-08-01T00:00:00.000Z');
    const woEnd = new Date('2026-08-05T00:00:00.000Z');
    const wo = await prisma.workOrder.create({
      data: {
        woNumber: `WO-MRP-${testRun}`,
        productId: assemblyId,
        lineId,
        quantity: 10,
        scheduledStart: woStart,
        scheduledEnd: woEnd,
        status: 'FIRM',
        strategy: 'WEEKLY',
        periodKey: '2026-W31',
      },
    });
    woId = wo.id;

    const location = await prisma.location.findFirstOrThrow({
      where: { active: true },
    });
    const bin = await prisma.bin.findFirstOrThrow({
      where: { locationId: location.id, active: true },
    });

    await adminCaller.inventory.receive({
      productId: buyPartId,
      binId: bin.id,
      quantity: 5,
      note: `MRP-INV-${testRun}`,
    });
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

  it('explodes multi-level BOM with scrap factor in requirements', async () => {
    if (!databaseAvailable) return;

    const requirements = await adminCaller.mrp.getRequirements({
      workOrderId: woId,
    });

    const buyPartReq = requirements.aggregated.find(
      (r) => r.productId === buyPartId,
    );
    const buyBoltReq = requirements.aggregated.find(
      (r) => r.productId === buyBoltId,
    );

    expect(buyPartReq).toBeDefined();
    expect(buyPartReq!.grossQty).toBeCloseTo(10 * 2 * 1.05, 2);
    expect(buyBoltReq).toBeDefined();
    expect(buyBoltReq!.grossQty).toBeCloseTo(10 * 4 * 1.1, 2);
  });

  it('nets inventory in requirements preview', async () => {
    if (!databaseAvailable) return;

    const requirements = await adminCaller.mrp.getRequirements({
      workOrderId: woId,
    });
    const buyPartNet = requirements.netRequirements.find(
      (r) => r.productId === buyPartId,
    );

    expect(buyPartNet).toBeDefined();
    expect(buyPartNet!.onHand).toBe(5);
    expect(buyPartNet!.netQty).toBeCloseTo(buyPartNet!.grossQty - 5, 2);
  });

  it('back-calculates need-by dates from lead time', async () => {
    if (!databaseAvailable) return;

    const requirements = await adminCaller.mrp.getRequirements({
      workOrderId: woId,
    });
    const buyPartReq = requirements.aggregated.find(
      (r) => r.productId === buyPartId,
    );

    expect(buyPartReq!.needByDate.toISOString().slice(0, 10)).toBe('2026-07-25');
  });

  it('generates purchase requisitions on MRP run', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;
    const result = await adminCaller.mrp.runMrp({});

    expect(result.workOrdersProcessed).toBeGreaterThan(0);
    expect(result.requisitionsCreated).toBeGreaterThan(0);

    const requisitions = await adminCaller.mrp.listRequisitions({
      status: 'PENDING',
    });
    const buyPartReq = requisitions.items.find(
      (r) => r.componentProductId === buyPartId,
    );
    expect(buyPartReq).toBeDefined();
    expect(buyPartReq!.quantity).toBeGreaterThan(0);

    expect(
      publishedEvents.some((e) => e.topic === MRP_EVENTS.run.completed),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === MRP_EVENTS.requisition.created),
    ).toBe(true);
  });

  it('re-running MRP is idempotent (no duplicate requisitions)', async () => {
    if (!databaseAvailable) return;

    const before = await adminCaller.mrp.listRequisitions({ status: 'PENDING' });
    const countBefore = before.total;

    const second = await adminCaller.mrp.runMrp({});
    expect(second.requisitionsCreated).toBe(0);

    const after = await adminCaller.mrp.listRequisitions({ status: 'PENDING' });
    expect(after.total).toBe(countBefore);
  });

  it('blocks Viewer from runMrp write', async () => {
    if (!databaseAvailable) return;

    await expect(viewerCaller.mrp.runMrp({})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
