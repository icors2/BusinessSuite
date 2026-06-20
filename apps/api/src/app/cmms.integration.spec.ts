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
import { ReturnsService } from 'returns';
import { AnalyticsService } from 'analytics';
import { CMMS_EVENTS, CmmsService } from 'cmms';
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
    console.warn('Database unavailable for CMMS integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

async function ensureCmmsUsers(client: PrismaClient): Promise<void> {
  const technicianRole = await client.role.upsert({
    where: { name: 'Technician' },
    update: {},
    create: { name: 'Technician' },
  });

  const hash = await bcrypt.hash('Technician123!', 12);
  const technician = await client.user.upsert({
    where: { email: 'technician@arcncode.local' },
    update: { passwordHash: hash },
    create: {
      email: 'technician@arcncode.local',
      passwordHash: hash,
    },
  });

  await client.userRole.upsert({
    where: {
      userId_roleId: { userId: technician.id, roleId: technicianRole.id },
    },
    update: {},
    create: { userId: technician.id, roleId: technicianRole.id },
  });
}

describe('CMMS tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let cmmsService: CmmsService;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let technicianCaller: ReturnType<
    ReturnType<typeof createAppRouter>['createCaller']
  >;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let workstationId: string;
  let assetId: string;
  let cycleRuleId: string;
  let calendarRuleId: string;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });

    await ensureCmmsUsers(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);

    cmmsService = app.get(CmmsService);

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
    technicianCaller = mkCaller(
      await login('technician@arcncode.local', 'Technician123!'),
    );
    viewerCaller = mkCaller(
      await login('viewer@arcncode.local', 'Viewer123!'),
    );

    const workstation = await prisma.workstation.create({
      data: {
        code: `WS-CMMS-${testRun}`,
        name: 'CMMS Test Workstation',
        status: 'ACTIVE',
      },
    });
    workstationId = workstation.id;

    const asset = await adminCaller.cmms.upsertAsset({
      code: `ASSET-CMMS-${testRun}`,
      name: 'CMMS Test Asset',
      workstationId,
    });
    assetId = asset.id;

    const cycleRule = await adminCaller.cmms.upsertPmRule({
      assetId,
      type: 'CYCLE_COUNT',
      thresholdCycles: 2,
    });
    cycleRuleId = cycleRule.id;

    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 45);
    calendarRuleId = (
      await prisma.pmTriggerRule.create({
        data: {
          assetId,
          type: 'CALENDAR',
          intervalDays: 30,
          lastTriggeredAt: past,
          active: true,
        },
      })
    ).id;
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

  it('auto-creates preventive MWO at cycle threshold without duplicates', async () => {
    if (!databaseAvailable) return;

    await cmmsService.recordCycleForWorkstation(workstationId);
    let mwos = await adminCaller.cmms.listMaintenanceWorkOrders({
      assetId,
      type: 'PREVENTIVE',
    });
    expect(mwos.items.filter((m) => m.triggerRuleId === cycleRuleId)).toHaveLength(
      0,
    );

    publishedEvents.length = 0;
    await cmmsService.recordCycleForWorkstation(workstationId);
    mwos = await adminCaller.cmms.listMaintenanceWorkOrders({
      assetId,
      type: 'PREVENTIVE',
    });
    const cycleMwos = mwos.items.filter((m) => m.triggerRuleId === cycleRuleId);
    expect(cycleMwos).toHaveLength(1);
    expect(cycleMwos[0]?.status).toBe('OPEN');
    expect(cycleMwos[0]?.type).toBe('PREVENTIVE');

    expect(
      publishedEvents.some((e) => e.topic === CMMS_EVENTS.pm.triggered),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === CMMS_EVENTS.workorder.created),
    ).toBe(true);

    publishedEvents.length = 0;
    await cmmsService.recordCycleForWorkstation(workstationId);
    mwos = await adminCaller.cmms.listMaintenanceWorkOrders({
      assetId,
      type: 'PREVENTIVE',
    });
    expect(
      mwos.items.filter(
        (m) =>
          m.triggerRuleId === cycleRuleId &&
          (m.status === 'OPEN' || m.status === 'IN_PROGRESS'),
      ),
    ).toHaveLength(1);
    expect(publishedEvents).toHaveLength(0);

    const openMwo = cycleMwos[0]!;
    await technicianCaller.cmms.completeMaintenanceWorkOrder({
      id: openMwo.id,
      notes: 'PM complete',
    });

    publishedEvents.length = 0;
    await cmmsService.recordCycleForWorkstation(workstationId);
    await cmmsService.recordCycleForWorkstation(workstationId);
    mwos = await adminCaller.cmms.listMaintenanceWorkOrders({
      assetId,
      type: 'PREVENTIVE',
    });
    const openAfterRearm = mwos.items.filter(
      (m) =>
        m.triggerRuleId === cycleRuleId &&
        (m.status === 'OPEN' || m.status === 'IN_PROGRESS'),
    );
    expect(openAfterRearm.length).toBeGreaterThanOrEqual(1);
    expect(
      publishedEvents.some((e) => e.topic === CMMS_EVENTS.pm.triggered),
    ).toBe(true);
  });

  it('creates calendar MWO via evaluateCalendarTriggers without duplicate while open', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;
    const first = await adminCaller.cmms.evaluateCalendarTriggers();
    expect(first.created).toBeGreaterThanOrEqual(1);

    const mwos = await adminCaller.cmms.listMaintenanceWorkOrders({
      assetId,
      type: 'PREVENTIVE',
    });
    const calMwos = mwos.items.filter((m) => m.triggerRuleId === calendarRuleId);
    expect(calMwos.length).toBeGreaterThanOrEqual(1);

    publishedEvents.length = 0;
    const second = await adminCaller.cmms.evaluateCalendarTriggers();
    expect(second.created).toBe(0);
  });

  it('allows Technician to complete MWO and blocks Viewer from upsertAsset', async () => {
    if (!databaseAvailable) return;

    const corrective = await adminCaller.cmms.createMaintenanceWorkOrder({
      assetId,
      description: 'Corrective test WO',
    });

    publishedEvents.length = 0;
    await technicianCaller.cmms.startMaintenanceWorkOrder({ id: corrective.id });
    const completed = await technicianCaller.cmms.completeMaintenanceWorkOrder({
      id: corrective.id,
      notes: 'Fixed',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(
      publishedEvents.some((e) => e.topic === CMMS_EVENTS.workorder.completed),
    ).toBe(true);

    await expect(
      viewerCaller.cmms.upsertAsset({
        code: `ASSET-VIEWER-${testRun}`,
        name: 'Blocked',
      }),
    ).rejects.toThrow(/Admin or Manager role required/i);
  });

  it('returns due-soon dashboard data and maintenance history for work order', async () => {
    if (!databaseAvailable) return;

    const dueSoon = await adminCaller.cmms.getDueSoon({});
    expect(dueSoon).toHaveProperty('maintenanceWorkOrders');
    expect(dueSoon).toHaveProperty('cycleRules');
    expect(dueSoon).toHaveProperty('calendarRules');

    const workOrder = await prisma.workOrder.findFirst({
      where: { woNumber: { contains: 'SEED' } },
    });
    if (workOrder) {
      const history = await adminCaller.cmms.getMaintenanceHistoryForWorkOrder({
        workOrderId: workOrder.id,
      });
      expect(history).toHaveProperty('assets');
      expect(history).toHaveProperty('maintenanceWorkOrders');
    }
  });
});

