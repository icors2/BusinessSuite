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
import { WORKFORCE_EVENTS, WorkforceService } from 'workforce';
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
    console.warn('Database unavailable for workforce integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

function normalizeDateUtc(d: Date): Date {
  const n = new Date(d);
  n.setUTCHours(0, 0, 0, 0);
  return n;
}

describe('Workforce tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let employeeId: string;
  let shiftId: string;
  let workingDay: Date;
  let workOrderId: string;

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

    workingDay = normalizeDateUtc(start);
    while (workingDay.getUTCDay() === 0 || workingDay.getUTCDay() === 6) {
      workingDay.setUTCDate(workingDay.getUTCDate() + 1);
    }

    const employee = await adminCaller.workforce.createEmployee({
      firstName: 'Test',
      lastName: `Worker-${testRun}`,
      department: 'Assembly',
      badgeCode: `BADGE-${testRun}`,
      laborRate: 25,
    });
    employeeId = employee.id;

    const shift = await adminCaller.workforce.upsertShift({
      code: `DAY-${testRun}`,
      name: 'Day Shift',
      startTime: '07:00',
      endTime: '15:00',
      daysOfWeek: [1, 2, 3, 4, 5],
    });
    shiftId = shift.id;

    const workOrder = await prisma.workOrder.findFirst({
      where: { woNumber: { contains: 'SEED' } },
    });
    workOrderId = workOrder?.id ?? '';
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('skips database tests when unavailable', () => {
    if (!databaseAvailable) {
      expect(true).toBe(true);
    }
  });

  it('assignShift succeeds on a working calendar day', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const assignment = await adminCaller.workforce.assignShift({
      shiftId,
      employeeId,
      date: workingDay,
    });

    expect(assignment.employeeId).toBe(employeeId);
    expect(
      publishedEvents.some((e) => e.topic === WORKFORCE_EVENTS.shift.assigned),
    ).toBe(true);
  });

  it('assignShift is blocked when employee is unavailable', async () => {
    if (!databaseAvailable) return;

    const blockedDay = new Date(workingDay);
    blockedDay.setUTCDate(blockedDay.getUTCDate() + 7);
    while (blockedDay.getUTCDay() === 0 || blockedDay.getUTCDay() === 6) {
      blockedDay.setUTCDate(blockedDay.getUTCDate() + 1);
    }

    await adminCaller.workforce.markUnavailable({
      employeeId,
      fromDate: blockedDay,
      toDate: blockedDay,
      reason: 'PTO',
    });

    await expect(
      adminCaller.workforce.assignShift({
        shiftId,
        employeeId,
        date: blockedDay,
      }),
    ).rejects.toThrow(/unavailable/i);
  });

  it('clock-in then clock-out computes duration', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const clockIn = new Date('2026-06-19T08:00:00.000Z');
    const clockOut = new Date('2026-06-19T12:00:00.000Z');

    await adminCaller.workforce.clockIn({
      employeeId,
      workOrderId: workOrderId || undefined,
      department: 'Assembly',
      clockIn,
    });

    const entry = await adminCaller.workforce.clockOut({
      employeeId,
      clockOut,
    });

    expect(entry.durationMinutes).toBe(240);
    expect(entry.status).toBe('CLOSED');
    expect(
      publishedEvents.some((e) => e.topic === WORKFORCE_EVENTS.clock.in),
    ).toBe(true);
    expect(
      publishedEvents.some((e) => e.topic === WORKFORCE_EVENTS.clock.out),
    ).toBe(true);
  });

  it('rejects double clock-in', async () => {
    if (!databaseAvailable) return;

    const badgeEmployee = await adminCaller.workforce.createEmployee({
      firstName: 'Double',
      lastName: `Clock-${testRun}`,
      badgeCode: `DBL-${testRun}`,
    });

    await adminCaller.workforce.clockIn({ employeeId: badgeEmployee.id });
    await expect(
      adminCaller.workforce.clockIn({ employeeId: badgeEmployee.id }),
    ).rejects.toThrow(/open time entry/i);
  });

  it('rejects orphaned clock-out', async () => {
    if (!databaseAvailable) return;

    const orphanEmployee = await adminCaller.workforce.createEmployee({
      firstName: 'Orphan',
      lastName: `Clock-${testRun}`,
      badgeCode: `ORP-${testRun}`,
    });

    await expect(
      adminCaller.workforce.clockOut({ employeeId: orphanEmployee.id }),
    ).rejects.toThrow(/open time entry/i);
  });

  it('flags over-max-shift without rejecting', async () => {
    if (!databaseAvailable) return;

    const longEmployee = await adminCaller.workforce.createEmployee({
      firstName: 'Long',
      lastName: `Shift-${testRun}`,
      badgeCode: `LNG-${testRun}`,
    });

    const clockIn = new Date('2026-06-19T06:00:00.000Z');
    const clockOut = new Date('2026-06-19T23:30:00.000Z');

    await adminCaller.workforce.clockIn({
      employeeId: longEmployee.id,
      clockIn,
    });

    const entry = await adminCaller.workforce.clockOut({
      employeeId: longEmployee.id,
      clockOut,
      maxShiftHours: 16,
    });

    expect(entry.status).toBe('FLAGGED');
    expect(entry.flagReason).toContain('exceeds_max_shift');
    expect(entry.durationMinutes).toBeGreaterThan(16 * 60);
  });

  it('labor cost report rolls up by work order and department', async () => {
    if (!databaseAvailable) return;

    const report = await adminCaller.workforce.getLaborCostReport({
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-12-31T23:59:59.999Z'),
    });

    expect(report.entryCount).toBeGreaterThan(0);
    expect(report.byDepartment.length).toBeGreaterThan(0);
    if (workOrderId) {
      expect(report.byWorkOrder.some((r) => r.workOrderId === workOrderId)).toBe(
        true,
      );
    }
  });

  it('blocks Viewer from workforce writes', async () => {
    if (!databaseAvailable) return;

    await expect(
      viewerCaller.workforce.createEmployee({
        firstName: 'Viewer',
        lastName: 'Blocked',
      }),
    ).rejects.toThrow(/Admin or Manager role required/i);
  });
});
