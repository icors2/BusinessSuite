import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AdminService } from 'admin';
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
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
import { AnalyticsService } from 'analytics';
import { QmsService } from 'qms';
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
  } catch {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('Admin Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let managerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) {
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

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

    const adminLogin = await import('supertest').then((m) =>
      m.default(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@arcncode.local', password: 'Admin123!' }),
    );

    const managerLogin = await import('supertest').then((m) =>
      m.default(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'manager@arcncode.local', password: 'Manager123!' }),
    );

    const adminPayload = jwt.decode(adminLogin.body.accessToken) as JwtPayload;
    const managerPayload = jwt.decode(managerLogin.body.accessToken) as JwtPayload;

    adminCaller = appRouter.createCaller({
      user: {
        userId: adminPayload.sub,
        email: adminPayload.email,
        roles: adminPayload.roles,
      },
    });

    managerCaller = appRouter.createCaller({
      user: {
        userId: managerPayload.sub,
        email: managerPayload.email,
        roles: managerPayload.roles,
      },
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists roles for admin', async () => {
    if (!databaseAvailable) {
      return;
    }

    const roles = await adminCaller.admin.listRoles();
    expect(roles.some((role) => role.name === 'Admin')).toBe(true);
  });

  it('denies manager access to admin routes', async () => {
    if (!databaseAvailable) {
      return;
    }

    await expect(managerCaller.admin.listUsers({})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('creates and lists users as admin', async () => {
    if (!databaseAvailable) {
      return;
    }

    const email = `admin-test-${Date.now()}@arcncode.local`;
    const created = await adminCaller.admin.createUser({
      email,
      password: 'TestPass123!',
      roleNames: ['Viewer'],
    });

    expect(created.email).toBe(email);
    expect(created.roles).toContain('Viewer');

    const listed = await adminCaller.admin.listUsers({ search: email });
    expect(listed.items.some((user) => user.id === created.id)).toBe(true);
  });
});
