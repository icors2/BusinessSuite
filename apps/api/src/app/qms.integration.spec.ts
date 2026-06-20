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
import { QMS_EVENTS, QmsService } from 'qms';
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
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
    console.warn('Database unavailable for QMS integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

async function ensureQmsUsers(client: PrismaClient): Promise<void> {
  const inspectorRole = await client.role.upsert({
    where: { name: 'Inspector' },
    update: {},
    create: { name: 'Inspector' },
  });

  const hash = await bcrypt.hash('Inspector123!', 12);
  const inspector = await client.user.upsert({
    where: { email: 'inspector@arcncode.local' },
    update: { passwordHash: hash },
    create: {
      email: 'inspector@arcncode.local',
      passwordHash: hash,
    },
  });

  await client.userRole.upsert({
    where: {
      userId_roleId: { userId: inspector.id, roleId: inspectorRole.id },
    },
    update: {},
    create: { userId: inspector.id, roleId: inspectorRole.id },
  });
}

describe('QMS tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let inspectorCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let supervisorCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let operatorCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let templateId: string;
  let passFailCriterionId: string;
  let measureCriterionId: string;
  let workOrderId: string;
  let operationId: string;
  let employeeId: string;
  let binId: string;
  let productId: string;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });

    await ensureQmsUsers(prisma);

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
    inspectorCaller = mkCaller(
      await login('inspector@arcncode.local', 'Inspector123!'),
    );
    supervisorCaller = mkCaller(
      await login('supervisor@arcncode.local', 'Supervisor123!'),
    );
    operatorCaller = mkCaller(
      await login('operator@arcncode.local', 'Operator123!'),
    );
    viewerCaller = mkCaller(
      await login('viewer@arcncode.local', 'Viewer123!'),
    );

    const template = await adminCaller.qms.upsertTemplate({
      code: `TMPL-QMS-${testRun}`,
      name: 'QMS Test Template',
    });
    templateId = template.id;

    const c1 = await adminCaller.qms.addCriterion({
      templateId,
      sequence: 1,
      label: 'Visual check',
      type: 'PASS_FAIL',
    });
    passFailCriterionId = c1.id;

    const c2 = await adminCaller.qms.addCriterion({
      templateId,
      sequence: 2,
      label: 'Dimension',
      type: 'MEASUREMENT',
      expectedMin: 10,
      expectedMax: 20,
      unit: 'mm',
    });
    measureCriterionId = c2.id;

    const product = await prisma.product.findFirstOrThrow();
    productId = product.id;

    const wo =
      (await prisma.workOrder.findFirst({
        where: { woNumber: { contains: 'SEED' } },
      })) ??
      (await prisma.workOrder.create({
        data: {
          woNumber: `WO-QMS-${testRun}`,
          productId,
          quantity: 10,
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'FIRM',
          strategy: 'WEEKLY',
          periodKey: '2026-W01',
        },
      }));
    workOrderId = wo.id;

    const gen = await adminCaller.mes.generateOperations({
      workOrderId,
      operations: [{ name: 'QMS test op' }],
    });
    operationId = gen.operations[0].id;

    const employee = await adminCaller.workforce.createEmployee({
      firstName: 'QMS',
      lastName: `Op-${testRun}`,
      badgeCode: `QMS-OP-${testRun}`,
    });
    employeeId = employee.id;

    const bin = await prisma.bin.findFirstOrThrow({ where: { active: true } });
    binId = bin.id;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  }, 30000);

  it('skips database tests when unavailable', () => {
    if (!databaseAvailable) {
      expect(true).toBe(true);
    }
  });

  it('completeInspection PASS emits event and creates no NC', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const result = await inspectorCaller.qms.completeInspection({
      templateId,
      workOrderId,
      results: [
        { criterionId: passFailCriterionId, passed: true },
        { criterionId: measureCriterionId, measuredValue: 15 },
      ],
    });

    expect(result.inspection.result).toBe('PASS');
    expect(result.nonConformance).toBeNull();
    expect(
      publishedEvents.some((e) => e.topic === QMS_EVENTS.inspection.completed),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === QMS_EVENTS.nonconformance.raised),
    ).toBe(false);
  }, 30000);

  it('completeInspection FAIL auto-raises NC with hold on work order', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const failWo = await prisma.workOrder.create({
      data: {
        woNumber: `WO-QMS-FAIL-${testRun}`,
        productId,
        quantity: 5,
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        status: 'FIRM',
        strategy: 'WEEKLY',
        periodKey: '2026-W01',
      },
    });

    const result = await inspectorCaller.qms.completeInspection({
      templateId,
      workOrderId: failWo.id,
      results: [
        { criterionId: passFailCriterionId, passed: false },
        { criterionId: measureCriterionId, measuredValue: 15 },
      ],
    });

    expect(result.inspection.result).toBe('FAIL');
    expect(result.nonConformance).toBeDefined();
    expect(result.nonConformance!.holdActive).toBe(true);

    const wo = await prisma.workOrder.findUniqueOrThrow({
      where: { id: failWo.id },
    });
    expect(wo.onHold).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === QMS_EVENTS.nonconformance.raised),
    ).toBe(true);
  }, 30000);

  it('MES startOperation blocked when work order on hold', async () => {
    if (!databaseAvailable) return;

    const heldWo = await prisma.workOrder.findFirstOrThrow({
      where: { woNumber: { contains: `WO-QMS-FAIL-${testRun}` } },
    });

    const gen = await adminCaller.mes.generateOperations({
      workOrderId: heldWo.id,
      operations: [{ name: 'Held op' }],
    });

    await adminCaller.workforce.clockIn({ employeeId });

    await expect(
      operatorCaller.mes.startOperation({
        operationId: gen.operations[0].id,
        employeeId,
      }),
    ).rejects.toThrow(/quality hold/i);
  }, 30000);

  it('disposition resolves NC and clears work order hold', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const nc = await prisma.nonConformanceRecord.findFirstOrThrow({
      where: { workOrder: { woNumber: { contains: `WO-QMS-FAIL-${testRun}` } } },
    });

    await supervisorCaller.qms.disposition({
      nonConformanceId: nc.id,
      disposition: 'REWORK',
      notes: 'Rework required',
    });

    const wo = await prisma.workOrder.findUniqueOrThrow({
      where: { id: nc.workOrderId! },
    });
    expect(wo.onHold).toBe(false);
    expect(
      publishedEvents.some((e) => e.topic === QMS_EVENTS.nonconformance.resolved),
    ).toBe(true);
  }, 30000);

  it('reportScrap holds bin and blocks WMS pick', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const holdBin = await prisma.bin.create({
      data: {
        locationId: (await prisma.location.findFirstOrThrow()).id,
        code: `HOLD-BIN-${testRun}`,
        description: 'Hold test bin',
      },
    });

    await adminCaller.inventory.receive({
      productId,
      binId: holdBin.id,
      quantity: 10,
      note: 'QMS hold test',
    });

    await inspectorCaller.qms.reportScrap({
      description: 'Scrap in bin',
      severity: 'HOLD',
      binId: holdBin.id,
      productId,
      quantityScrapped: 2,
    });

    const bin = await prisma.bin.findUniqueOrThrow({ where: { id: holdBin.id } });
    expect(bin.onHold).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === QMS_EVENTS.scrap.reported),
    ).toBe(true);

    await expect(
      adminCaller.inventory.pick({
        productId,
        binId: holdBin.id,
        quantity: 1,
      }),
    ).rejects.toThrow(/quality hold/i);
  }, 30000);

  it('blocks Inspector from disposition and Viewer from completeInspection', async () => {
    if (!databaseAvailable) return;

    const nc = await prisma.nonConformanceRecord.create({
      data: {
        ncNumber: `NC-TEST-${testRun}`,
        source: 'INSPECTION',
        severity: 'MINOR',
        description: 'RBAC test',
        raisedByUserId: (await prisma.user.findFirstOrThrow()).id,
      },
    });

    await expect(
      inspectorCaller.qms.disposition({
        nonConformanceId: nc.id,
        disposition: 'USE_AS_IS',
      }),
    ).rejects.toThrow(/Supervisor role required/i);

    await expect(
      viewerCaller.qms.completeInspection({
        templateId,
        results: [
          { criterionId: passFailCriterionId, passed: true },
          { criterionId: measureCriterionId, measuredValue: 15 },
        ],
      }),
    ).rejects.toThrow(/Inspector role or higher required/i);
  }, 30000);
});

