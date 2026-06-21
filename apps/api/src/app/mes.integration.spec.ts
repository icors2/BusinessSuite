import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { io, Socket } from 'socket.io-client';
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
import { MES_EVENTS, MesGateway, MesService } from 'mes';
import { QmsService } from 'qms';
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
import { AdminService } from 'admin';
import { AnalyticsService } from 'analytics';
import { EVENT_BUS, EventBus } from 'event-bus';
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
    console.warn('Database unavailable for MES integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

async function ensureMesUsers(client: PrismaClient): Promise<void> {
  const operatorRole = await client.role.upsert({
    where: { name: 'Operator' },
    update: {},
    create: { name: 'Operator' },
  });
  const supervisorRole = await client.role.upsert({
    where: { name: 'Supervisor' },
    update: {},
    create: { name: 'Supervisor' },
  });

  const operatorHash = await bcrypt.hash('Operator123!', 12);
  const supervisorHash = await bcrypt.hash('Supervisor123!', 12);

  const operator = await client.user.upsert({
    where: { email: 'operator@arcncode.local' },
    update: { passwordHash: operatorHash },
    create: {
      email: 'operator@arcncode.local',
      passwordHash: operatorHash,
    },
  });

  const supervisor = await client.user.upsert({
    where: { email: 'supervisor@arcncode.local' },
    update: { passwordHash: supervisorHash },
    create: {
      email: 'supervisor@arcncode.local',
      passwordHash: supervisorHash,
    },
  });

  await client.userRole.upsert({
    where: { userId_roleId: { userId: operator.id, roleId: operatorRole.id } },
    update: {},
    create: { userId: operator.id, roleId: operatorRole.id },
  });

  await client.userRole.upsert({
    where: {
      userId_roleId: { userId: supervisor.id, roleId: supervisorRole.id },
    },
    update: {},
    create: { userId: supervisor.id, roleId: supervisorRole.id },
  });
}

describe('MES tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let operatorCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let supervisorCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  const publishedEvents: Array<{ topic: string; payload: unknown }> = [];
  const testRun = Date.now();

  let workOrderId: string;
  let operation1Id: string;
  let operation2Id: string;
  let employeeId: string;
  let workstationId: string;
  let cycle1Id: string;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });

    await ensureMesUsers(prisma);

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

    const adminPayload = await login('admin@arcncode.local', 'Admin123!');
    const operatorPayload = await login('operator@arcncode.local', 'Operator123!');
    const supervisorPayload = await login(
      'supervisor@arcncode.local',
      'Supervisor123!',
    );
    const viewerPayload = await login('viewer@arcncode.local', 'Viewer123!');

    const mkCaller = (payload: JwtPayload) =>
      appRouter.createCaller({
        user: {
          userId: payload.sub,
          email: payload.email,
          roles: payload.roles,
        },
      });

    adminCaller = mkCaller(adminPayload);
    operatorCaller = mkCaller(operatorPayload);
    supervisorCaller = mkCaller(supervisorPayload);
    viewerCaller = mkCaller(viewerPayload);

    const ws = await adminCaller.mes.upsertWorkstation({
      code: `WS-MES-${testRun}`,
      name: 'MES Test Workstation',
    });
    workstationId = ws.id;

    const wo =
      (await prisma.workOrder.findFirst({
        where: { woNumber: { contains: 'SEED' } },
      })) ??
      (await prisma.workOrder.create({
        data: {
          woNumber: `WO-MES-${testRun}`,
          productId: (await prisma.product.findFirstOrThrow()).id,
          quantity: 10,
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'FIRM',
          strategy: 'WEEKLY',
          periodKey: '2026-W01',
        },
      }));
    workOrderId = wo.id;

    const generated = await adminCaller.mes.generateOperations({
      workOrderId,
      operations: [
        { name: 'Op 1 Cut', workstationId, standardMinutes: 30 },
        { name: 'Op 2 Assembly', workstationId, standardMinutes: 45 },
      ],
    });
    operation1Id = generated.operations[0].id;
    operation2Id = generated.operations[1].id;

    const employee = await adminCaller.workforce.createEmployee({
      firstName: 'MES',
      lastName: `Operator-${testRun}`,
      badgeCode: `MES-OP-${testRun}`,
    });
    employeeId = employee.id;
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

  it('startOperation succeeds when operator is clocked in', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    await adminCaller.workforce.clockIn({ employeeId });

    const result = await operatorCaller.mes.startOperation({
      operationId: operation1Id,
      employeeId,
    });

    cycle1Id = result.cycle.id;
    expect(result.cycle.employeeId).toBe(employeeId);
    expect(result.operation.status).toBe('IN_PROGRESS');
    expect(
      publishedEvents.some((e) => e.topic === MES_EVENTS.operation.started),
    ).toBe(true);
  }, 30000);

  it('rejects startOperation when operator is not clocked in', async () => {
    if (!databaseAvailable) return;

    const emp = await adminCaller.workforce.createEmployee({
      firstName: 'Not',
      lastName: `Clocked-${testRun}`,
      badgeCode: `NOCLK-${testRun}`,
    });

    await expect(
      operatorCaller.mes.startOperation({
        operationId: operation2Id,
        employeeId: emp.id,
      }),
    ).rejects.toThrow(/clocked in/i);
  });

  it('stopOperation computes duration and completes operation', async () => {
    if (!databaseAvailable) return;

    const cycle = await prisma.cycleRecord.findUniqueOrThrow({
      where: { id: cycle1Id },
    });

    const startedAt = new Date(cycle.startedAt);
    const endedAt = new Date(startedAt.getTime() + 45 * 60 * 1000);

    const result = await operatorCaller.mes.stopOperation({
      cycleId: cycle.id,
      quantityCompleted: 5,
      endedAt,
    });

    expect(result.cycle.durationMinutes).toBe(45);
    expect(result.operation.status).toBe('COMPLETED');
  }, 30000);

  it('blocks verification until all operations are completed', async () => {
    if (!databaseAvailable) return;

    await expect(
      supervisorCaller.mes.verifyWorkOrder({ workOrderId }),
    ).rejects.toThrow(/completed/i);
  });

  it('supervisor verifyWorkOrder succeeds after all ops complete', async () => {
    if (!databaseAvailable) return;

    publishedEvents.length = 0;

    const start = await operatorCaller.mes.startOperation({
      operationId: operation2Id,
      employeeId,
    });

    const endedAt = new Date(start.cycle.startedAt);
    endedAt.setMinutes(endedAt.getMinutes() + 30);

    await operatorCaller.mes.stopOperation({
      cycleId: start.cycle.id,
      quantityCompleted: 5,
      endedAt,
    });

    const verification = await supervisorCaller.mes.verifyWorkOrder({
      workOrderId,
      notes: 'All good',
    });

    expect(verification.workOrderId).toBe(workOrderId);

    const wo = await prisma.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
    });
    expect(wo.status).toBe('VERIFIED');
    expect(
      publishedEvents.some((e) => e.topic === MES_EVENTS.workorder.verified),
    ).toBe(true);
  }, 30000);

  it('blocks Operator from verify and Viewer from start', async () => {
    if (!databaseAvailable) return;

    const wo = await prisma.workOrder.create({
      data: {
        woNumber: `WO-MES-BLOCK-${testRun}`,
        productId: (await prisma.product.findFirstOrThrow()).id,
        quantity: 1,
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        status: 'AWAITING_VERIFICATION',
        strategy: 'WEEKLY',
        periodKey: '2026-W01',
      },
    });

    await expect(
      operatorCaller.mes.verifyWorkOrder({ workOrderId: wo.id }),
    ).rejects.toThrow(/Supervisor role required/i);

    const gen = await adminCaller.mes.generateOperations({
      workOrderId: wo.id,
      operations: [{ name: 'Block test op' }],
    });

    await expect(
      viewerCaller.mes.startOperation({
        operationId: gen.operations[0].id,
        employeeId,
      }),
    ).rejects.toThrow(/Operator role or higher required/i);
  });

  it('gateway broadcasts mes events to connected clients', async () => {
    if (!databaseAvailable) return;

    const gateway = app.get(MesGateway);
    const httpServer = app.getHttpServer();
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 3000;

    const adminLogin = await import('supertest').then((m) =>
      m.default(httpServer)
        .post('/api/auth/login')
        .send({ email: 'admin@arcncode.local', password: 'Admin123!' }),
    );
    const token = adminLogin.body.accessToken as string;

    const received: unknown[] = [];
    const socket: Socket = io(`http://127.0.0.1:${port}/mes`, {
      auth: { token },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    socket.on('mes.event', (payload) => {
      received.push(payload);
    });

    gateway.broadcast(MES_EVENTS.cycle.recorded, {
      topic: MES_EVENTS.cycle.recorded,
      entityId: 'test-cycle',
      timestamp: new Date().toISOString(),
      version: 1,
      payload: { test: true },
    });

    await new Promise((r) => setTimeout(r, 500));

    expect(received.length).toBeGreaterThan(0);
    socket.disconnect();
  }, 30000);
});

