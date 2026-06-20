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
import { DocumentService } from 'plm';
import { InventoryService, LocationService } from 'wms';
import { CpqCatalogService, QuoteService } from 'cpq';
import { SalesOrderService } from 'sales';
import { StorageService } from 'storage';
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
    console.warn('Database unavailable for PLM integration tests:', error);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

async function isMinioAvailable(storage: StorageService): Promise<boolean> {
  try {
    await storage.ensureBucket();
    return true;
  } catch (error) {
    console.warn('MinIO unavailable for PLM integration tests:', error);
    return false;
  }
}

describe('PLM Integration', () => {
  let app: INestApplication;
  let databaseAvailable = false;
  let minioAvailable = false;
  let adminToken = '';
  let viewerToken = '';
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

    const storage = app.get(StorageService);
    minioAvailable = await isMinioAvailable(storage);

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
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@arcncode.local', password: 'Admin123!' });

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'viewer@arcncode.local', password: 'Viewer123!' });

    adminToken = adminLogin.body.accessToken;
    viewerToken = viewerLogin.body.accessToken;

    const adminPayload = jwt.decode(adminToken) as JwtPayload;
    const viewerPayload = jwt.decode(viewerToken) as JwtPayload;

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

  it('uploads and downloads a revision byte-for-byte via MinIO', async () => {
    if (!databaseAvailable || !minioAvailable) return;

    const products = await adminCaller.product.list({ search: 'SKU-001' });
    expect(products.items.length).toBeGreaterThan(0);
    const productId = products.items[0].id;

    const document = await adminCaller.document.create({
      productId,
      name: `PLM Test Doc ${Date.now()}`,
      docType: 'spec',
    });

    const payload = Buffer.from(`plm-roundtrip-${Date.now()}-${Math.random()}`);

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', payload, {
        filename: 'roundtrip.txt',
        contentType: 'text/plain',
      });

    expect(uploadRes.status).toBe(201);
    const revisionId = uploadRes.body.id;

    const downloadRes = await request(app.getHttpServer())
      .get(`/api/documents/revisions/${revisionId}/download`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(downloadRes.status).toBe(200);
    expect(Buffer.compare(downloadRes.body as Buffer, payload)).toBe(0);
  });

  it('moves revision through Draft -> In Review -> Released lifecycle', async () => {
    if (!databaseAvailable || !minioAvailable) return;

    const products = await adminCaller.product.list({ search: 'SKU-002' });
    const productId = products.items[0].id;

    const document = await adminCaller.document.create({
      productId,
      name: `Lifecycle Doc ${Date.now()}`,
    });

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('lifecycle v1'), {
        filename: 'lifecycle.txt',
        contentType: 'text/plain',
      });

    const revisionId = uploadRes.body.id;
    expect(uploadRes.body.status).toBe('DRAFT');

    const inReview = await adminCaller.document.transition({
      revisionId,
      targetStatus: 'IN_REVIEW',
    });
    expect(inReview.status).toBe('IN_REVIEW');

    const released = await adminCaller.document.transition({
      revisionId,
      targetStatus: 'RELEASED',
    });
    expect(released.status).toBe('RELEASED');

    const revisions = await adminCaller.document.revisions({
      documentId: document.id,
    });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].status).toBe('RELEASED');
  });

  it('obsoletes prior released revision when releasing a new one', async () => {
    if (!databaseAvailable || !minioAvailable) return;

    const products = await adminCaller.product.list({});
    const productId = products.items[0].id;

    const document = await adminCaller.document.create({
      productId,
      name: `Single Released Doc ${Date.now()}`,
    });

    const rev1Upload = await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('rev1'), {
        filename: 'rev1.txt',
        contentType: 'text/plain',
      });
    const rev1Id = rev1Upload.body.id;

    await adminCaller.document.transition({
      revisionId: rev1Id,
      targetStatus: 'IN_REVIEW',
    });
    await adminCaller.document.transition({
      revisionId: rev1Id,
      targetStatus: 'RELEASED',
    });

    const rev2Upload = await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('rev2'), {
        filename: 'rev2.txt',
        contentType: 'text/plain',
      });
    const rev2Id = rev2Upload.body.id;

    await adminCaller.document.transition({
      revisionId: rev2Id,
      targetStatus: 'IN_REVIEW',
    });
    await adminCaller.document.transition({
      revisionId: rev2Id,
      targetStatus: 'RELEASED',
    });

    const revisions = await adminCaller.document.revisions({
      documentId: document.id,
    });

    const rev1 = revisions.find((r) => r.id === rev1Id);
    const rev2 = revisions.find((r) => r.id === rev2Id);
    expect(rev1?.status).toBe('OBSOLETE');
    expect(rev2?.status).toBe('RELEASED');

    const releasedCount = revisions.filter((r) => r.status === 'RELEASED').length;
    expect(releasedCount).toBe(1);
  });

  it('blocks Viewer from document create and upload', async () => {
    if (!databaseAvailable || !minioAvailable) return;

    const products = await viewerCaller.product.list({});
    const productId = products.items[0].id;

    await expect(
      viewerCaller.document.create({
        productId,
        name: 'Viewer blocked',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const adminDoc = await adminCaller.document.create({
      productId,
      name: `Viewer Upload Block ${Date.now()}`,
    });

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/documents/${adminDoc.id}/revisions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .attach('file', Buffer.from('blocked'), {
        filename: 'blocked.txt',
        contentType: 'text/plain',
      });

    expect(uploadRes.status).toBe(403);
  });
});
