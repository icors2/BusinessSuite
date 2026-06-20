import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
import { createAppRouter } from 'trpc';
import { DocumentService } from 'plm';
import { InventoryService, LocationService } from 'wms';
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
    console.warn('Database unavailable for integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('Finance tRPC Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let adminCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;
  let viewerCaller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) return;

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
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@arcncode.local', password: 'Admin123!' });

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'viewer@arcncode.local', password: 'Viewer123!' });

    const adminPayload = jwt.decode(
      adminLogin.body.accessToken,
    ) as JwtPayload;
    const viewerPayload = jwt.decode(
      viewerLogin.body.accessToken,
    ) as JwtPayload;

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
    if (app) {
      await app.close();
    }
  }, 30000);

  it('rejects unbalanced journal entries on post', async () => {
    if (!databaseAvailable) return;

    const cash = await adminCaller.account.list({ search: '1000' });
    const revenue = await adminCaller.account.list({ search: '4000' });
    const cashAcct = cash.items.find((a) => a.code === '1000');
    const revAcct = revenue.items.find((a) => a.code === '4000');
    expect(cashAcct).toBeDefined();
    expect(revAcct).toBeDefined();

    const draft = await adminCaller.journal.create({
      date: new Date(),
      memo: 'Unbalanced test',
      lines: [
        { accountId: cashAcct!.id, debit: 100, credit: 0 },
        { accountId: revAcct!.id, debit: 0, credit: 50 },
      ],
    });

    await expect(adminCaller.journal.post({ id: draft.id })).rejects.toMatchObject({
      message: expect.stringMatching(/unbalanced/i),
    });
  });

  it('creates, posts, and pays an invoice', async () => {
    if (!databaseAvailable) return;

    const customers = await adminCaller.customer.list({ search: 'Acme' });
    expect(customers.items.length).toBeGreaterThan(0);
    const customerId = customers.items[0].id;

    const invoice = await adminCaller.invoice.create({
      customerId,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      lines: [{ description: 'Test item', quantity: 2, unitPrice: 75 }],
    });
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.total).toBe(150);

    const posted = await adminCaller.invoice.post({ id: invoice.id });
    expect(posted.status).toBe('OPEN');
    expect(posted.amountDue).toBe(150);

    await adminCaller.invoice.recordPayment({
      invoiceId: invoice.id,
      amount: 150,
      date: new Date(),
      method: 'Check',
    });

    const paid = await adminCaller.invoice.get({ id: invoice.id });
    expect(paid.status).toBe('PAID');
    expect(paid.amountDue).toBe(0);
  });

  it('P&L and Balance Sheet match seed data totals', async () => {
    if (!databaseAvailable) return;

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    const pl = await adminCaller.report.profitAndLoss({ from, to });

    expect(pl.totalRevenue).toBe(1500);
    expect(pl.totalExpenses).toBe(500);
    expect(pl.netIncome).toBe(1000);

    const bs = await adminCaller.report.balanceSheet({ asOf: new Date('2026-01-31') });
    expect(bs.totalAssets).toBe(1300);
    expect(bs.totalLiabilities).toBe(300);
    expect(bs.totalEquity).toBe(1000);
    expect(bs.balanced).toBe(true);
  });

  it('blocks viewer from creating accounts', async () => {
    if (!databaseAvailable) return;

    const list = await viewerCaller.account.list({});
    expect(Array.isArray(list.items)).toBe(true);

    await expect(
      viewerCaller.account.create({
        code: `V${Date.now()}`,
        name: 'Viewer Test',
        type: 'EXPENSE',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
