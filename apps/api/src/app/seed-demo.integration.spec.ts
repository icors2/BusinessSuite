import { PrismaClient } from '@prisma/client';
import { seedDemo } from '../../../../libs/shared/database/prisma/seed-demo';
import { DEMO } from '../../../../libs/shared/database/prisma/seed-helpers';

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

describe('seed-demo integration', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  beforeAll(async () => {
    const available = await isDatabaseAvailable();
    if (!available) {
      console.warn('Database unavailable — skipping seed-demo integration tests');
      return;
    }
    await seedDemo();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('links shipped sales order to demo invoice', async () => {
    const available = await isDatabaseAvailable();
    if (!available) return;

    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { orderNumber: DEMO.SO_SHIPPED },
      include: { shipments: true },
    });
    expect(order.status).toBe('SHIPPED');

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { invoiceNumber: DEMO.INV_SHIPPED },
    });
    expect(order.shipments[0]?.invoiceId).toBe(invoice.id);
  });

  it('creates demo CPQ quote lifecycle records', async () => {
    const available = await isDatabaseAvailable();
    if (!available) return;

    const draft = await prisma.quote.findUniqueOrThrow({
      where: { quoteNumber: DEMO.Q_DRAFT },
    });
    const sent = await prisma.quote.findUniqueOrThrow({
      where: { quoteNumber: DEMO.Q_SENT },
    });
    const accepted = await prisma.quote.findUniqueOrThrow({
      where: { quoteNumber: DEMO.Q_ACCEPTED },
    });
    expect(draft.status).toBe('DRAFT');
    expect(sent.status).toBe('SENT');
    expect(accepted.status).toBe('ACCEPTED');
  });

  it('seeds procurement chain and open MES cycle', async () => {
    const available = await isDatabaseAvailable();
    if (!available) return;

    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { poNumber: DEMO.PO_PARTIAL },
    });
    expect(po.status).toBe('ISSUED');

    const wo = await prisma.workOrder.findUniqueOrThrow({
      where: { woNumber: DEMO.WO_DEMO },
    });
    const openCycle = await prisma.cycleRecord.findFirst({
      where: {
        operation: { workOrderId: wo.id },
        endedAt: null,
      },
    });
    expect(openCycle).not.toBeNull();

    const clockedIn = await prisma.timeEntry.findFirst({
      where: { employee: { employeeNumber: 'EMP-DEMO-01' }, status: 'OPEN' },
    });
    expect(clockedIn).not.toBeNull();
  });

  it('seeds returns RMA stages and analytics guard event', async () => {
    const available = await isDatabaseAvailable();
    if (!available) return;

    const rmas = await prisma.rma.findMany({
      where: {
        rmaNumber: {
          in: [
            DEMO.RMA_REQUESTED,
            DEMO.RMA_APPROVED,
            DEMO.RMA_RECEIVED,
            DEMO.RMA_RESOLVED,
          ],
        },
      },
    });
    expect(rmas).toHaveLength(4);

    const guard = await prisma.analyticsEvent.findUnique({
      where: { dedupeKey: 'DEMO-SEED-ANALYTICS-GUARD' },
    });
    expect(guard).not.toBeNull();
  });
});
