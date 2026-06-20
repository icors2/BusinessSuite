import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
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

describe('API Integration (e2e)', () => {
  let app: INestApplication;
  let databaseAvailable = false;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) {
      console.warn('Skipping API integration tests: database unavailable');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api returns service info', async () => {
    if (!databaseAvailable) {
      return;
    }

    await request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toContain('Arc N Code');
      });
  });

  it('registers, logs in, and accesses role-gated endpoints', async () => {
    if (!databaseAvailable) {
      return;
    }

    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, roleNames: ['Manager'] })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    const { accessToken } = loginRes.body;
    expect(accessToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/auth/manager-or-admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/admin-only')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('GET /api/health reports dependency status', async () => {
    if (!databaseAvailable) {
      return;
    }

    const res = await request(app.getHttpServer()).get('/api/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('info');
  });
});
