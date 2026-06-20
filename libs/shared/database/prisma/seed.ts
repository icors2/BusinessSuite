import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: { name: 'Manager' },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: { name: 'Viewer' },
  });

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@arcncode.local' },
    update: {},
    create: {
      email: 'admin@arcncode.local',
      passwordHash,
      roles: {
        create: [{ roleId: adminRole.id }],
      },
    },
  });

  const managerPasswordHash = await bcrypt.hash('Manager123!', 12);

  await prisma.user.upsert({
    where: { email: 'manager@arcncode.local' },
    update: {},
    create: {
      email: 'manager@arcncode.local',
      passwordHash: managerPasswordHash,
      roles: {
        create: [{ roleId: managerRole.id }],
      },
    },
  });

  const viewerPasswordHash = await bcrypt.hash('Viewer123!', 12);

  await prisma.user.upsert({
    where: { email: 'viewer@arcncode.local' },
    update: {},
    create: {
      email: 'viewer@arcncode.local',
      passwordHash: viewerPasswordHash,
      roles: {
        create: [{ roleId: viewerRole.id }],
      },
    },
  });

  await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      sku: 'SKU-001',
      description: 'Sample Widget A',
      unitOfMeasure: 'EA',
      category: 'Widgets',
    },
  });

  await prisma.product.upsert({
    where: { sku: 'SKU-002' },
    update: {},
    create: {
      sku: 'SKU-002',
      description: 'Sample Widget B',
      unitOfMeasure: 'EA',
      category: 'Widgets',
    },
  });

  const seedProduct = await prisma.product.findUnique({
    where: { sku: 'SKU-001' },
  });

  if (seedProduct) {
    const existingPlmDoc = await prisma.document.findFirst({
      where: {
        productId: seedProduct.id,
        name: 'Widget A Assembly Drawing',
      },
    });

    if (!existingPlmDoc) {
      const revisionId = randomUUID();
      const document = await prisma.document.create({
        data: {
          productId: seedProduct.id,
          name: 'Widget A Assembly Drawing',
          docType: 'drawing',
          revisions: {
            create: {
              id: revisionId,
              revisionNumber: 1,
              status: 'DRAFT',
              fileName: 'assembly-v1.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 0,
              objectKey: `documents/seed/${revisionId}-assembly-v1.pdf`,
              notes: 'Seed metadata only — upload a file to store in MinIO',
            },
          },
        },
        include: { revisions: true },
      });

      await prisma.document.update({
        where: { id: document.id },
        data: { currentRevisionId: document.revisions[0].id },
      });
    }
  }

  const mainLocation = await prisma.location.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      code: 'MAIN',
      name: 'Main Warehouse',
      type: 'warehouse',
    },
  });

  const binA01 = await prisma.bin.upsert({
    where: { code: 'A-01-01' },
    update: {},
    create: {
      locationId: mainLocation.id,
      code: 'A-01-01',
      description: 'Aisle A, Rack 1, Level 1',
    },
  });

  const binA02 = await prisma.bin.upsert({
    where: { code: 'A-01-02' },
    update: {},
    create: {
      locationId: mainLocation.id,
      code: 'A-01-02',
      description: 'Aisle A, Rack 1, Level 2',
    },
  });

  const product1 = await prisma.product.findUnique({ where: { sku: 'SKU-001' } });
  const product2 = await prisma.product.findUnique({ where: { sku: 'SKU-002' } });

  if (product1) {
    await prisma.inventoryQuantity.upsert({
      where: {
        productId_binId: { productId: product1.id, binId: binA01.id },
      },
      update: { onHand: 100, allocated: 0 },
      create: {
        productId: product1.id,
        binId: binA01.id,
        onHand: 100,
        allocated: 0,
      },
    });
  }

  if (product2) {
    await prisma.inventoryQuantity.upsert({
      where: {
        productId_binId: { productId: product2.id, binId: binA02.id },
      },
      update: { onHand: 50, allocated: 0 },
      create: {
        productId: product2.id,
        binId: binA02.id,
        onHand: 50,
        allocated: 0,
      },
    });
  }

  const customer = await prisma.customer.findFirst({
    where: { name: 'Acme Manufacturing', deletedAt: null },
  });

  if (!customer) {
    await prisma.customer.create({
      data: {
        name: 'Acme Manufacturing',
        email: 'orders@acme.example',
        phone: '555-0100',
        billingAddress: {
          line1: '100 Industrial Blvd',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'US',
        },
        creditTerms: 'Net 30',
      },
    });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { name: 'Global Supplies Co', deletedAt: null },
  });

  if (!vendor) {
    await prisma.vendor.create({
      data: {
        name: 'Global Supplies Co',
        email: 'ap@globalsupplies.example',
        phone: '555-0200',
        address: {
          line1: '500 Warehouse Way',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'US',
        },
        paymentTerms: 'Net 45',
      },
    });
  }

  await seedFinance(prisma);

  console.log('Seed complete:', {
    adminUserId: adminUser.id,
    roles: [adminRole.name, managerRole.name, viewerRole.name],
  });
}

/** Phase 3 — Chart of Accounts + sample posted AR/AP for report verification. */
async function seedFinance(client: PrismaClient): Promise<void> {
  const accounts = [
    { code: '1000', name: 'Cash', type: 'ASSET' as const },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' as const },
    { code: '3000', name: 'Owner Equity', type: 'EQUITY' as const },
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' as const },
    { code: '5000', name: 'Operating Expense', type: 'EXPENSE' as const },
  ];

  for (const acct of accounts) {
    await client.account.upsert({
      where: { code: acct.code },
      update: { name: acct.name, type: acct.type },
      create: acct,
    });
  }

  const existingSeedInvoice = await client.invoice.findUnique({
    where: { invoiceNumber: 'INV-SEED-001' },
  });
  if (existingSeedInvoice) {
    return;
  }

  const customer = await client.customer.findFirstOrThrow({
    where: { name: 'Acme Manufacturing', deletedAt: null },
  });
  const vendorRecord = await client.vendor.findFirstOrThrow({
    where: { name: 'Global Supplies Co', deletedAt: null },
  });

  const cash = await client.account.findUniqueOrThrow({ where: { code: '1000' } });
  const ar = await client.account.findUniqueOrThrow({ where: { code: '1100' } });
  const ap = await client.account.findUniqueOrThrow({ where: { code: '2000' } });
  const revenue = await client.account.findUniqueOrThrow({ where: { code: '4000' } });
  const expense = await client.account.findUniqueOrThrow({ where: { code: '5000' } });

  const seedDate = new Date('2026-01-15');

  async function postJournal(
    entryNumber: string,
    memo: string,
    lines: { accountId: string; debit: number; credit: number; description: string }[],
  ) {
    return client.journalEntry.create({
      data: {
        entryNumber,
        date: seedDate,
        memo,
        status: 'POSTED',
        postedAt: seedDate,
        lines: { create: lines },
      },
    });
  }

  // Invoice INV-SEED-001: $1000 OPEN (unpaid) — revenue + AR
  const jeInv1 = await postJournal('JE-SEED-001', 'Invoice INV-SEED-001', [
    { accountId: ar.id, debit: 1000, credit: 0, description: 'AR' },
    { accountId: revenue.id, debit: 0, credit: 1000, description: 'Revenue' },
  ]);
  await client.invoice.create({
    data: {
      invoiceNumber: 'INV-SEED-001',
      customerId: customer.id,
      issueDate: seedDate,
      dueDate: new Date('2026-02-15'),
      status: 'OPEN',
      total: 1000,
      amountPaid: 0,
      journalEntryId: jeInv1.id,
      lines: {
        create: [
          { description: 'Widget A x10', quantity: 10, unitPrice: 50, amount: 500 },
          { description: 'Widget B x10', quantity: 10, unitPrice: 50, amount: 500 },
        ],
      },
    },
  });

  // Invoice INV-SEED-002: $500 PAID
  const jeInv2 = await postJournal('JE-SEED-002', 'Invoice INV-SEED-002', [
    { accountId: ar.id, debit: 500, credit: 0, description: 'AR' },
    { accountId: revenue.id, debit: 0, credit: 500, description: 'Revenue' },
  ]);
  const inv2 = await client.invoice.create({
    data: {
      invoiceNumber: 'INV-SEED-002',
      customerId: customer.id,
      issueDate: seedDate,
      dueDate: new Date('2026-02-15'),
      status: 'PAID',
      total: 500,
      amountPaid: 500,
      journalEntryId: jeInv2.id,
      lines: {
        create: [
          { description: 'Service fee', quantity: 1, unitPrice: 500, amount: 500 },
        ],
      },
    },
  });
  const jePayInv2 = await postJournal('JE-SEED-003', 'Payment INV-SEED-002', [
    { accountId: cash.id, debit: 500, credit: 0, description: 'Cash' },
    { accountId: ar.id, debit: 0, credit: 500, description: 'AR payment' },
  ]);
  await client.payment.create({
    data: {
      type: 'INVOICE',
      invoiceId: inv2.id,
      amount: 500,
      date: seedDate,
      method: 'Check',
      journalEntryId: jePayInv2.id,
    },
  });

  // Bill BILL-SEED-001: $300 OPEN
  const jeBill1 = await postJournal('JE-SEED-004', 'Bill BILL-SEED-001', [
    { accountId: expense.id, debit: 300, credit: 0, description: 'Supplies' },
    { accountId: ap.id, debit: 0, credit: 300, description: 'AP' },
  ]);
  await client.bill.create({
    data: {
      billNumber: 'BILL-SEED-001',
      vendorId: vendorRecord.id,
      issueDate: seedDate,
      dueDate: new Date('2026-02-28'),
      status: 'OPEN',
      total: 300,
      amountPaid: 0,
      journalEntryId: jeBill1.id,
      lines: {
        create: [
          {
            description: 'Office supplies',
            quantity: 1,
            unitPrice: 300,
            amount: 300,
            expenseAccountId: expense.id,
          },
        ],
      },
    },
  });

  // Bill BILL-SEED-002: $200 PAID
  const jeBill2 = await postJournal('JE-SEED-005', 'Bill BILL-SEED-002', [
    { accountId: expense.id, debit: 200, credit: 0, description: 'Utilities' },
    { accountId: ap.id, debit: 0, credit: 200, description: 'AP' },
  ]);
  const bill2 = await client.bill.create({
    data: {
      billNumber: 'BILL-SEED-002',
      vendorId: vendorRecord.id,
      issueDate: seedDate,
      dueDate: new Date('2026-02-28'),
      status: 'PAID',
      total: 200,
      amountPaid: 200,
      journalEntryId: jeBill2.id,
      lines: {
        create: [
          {
            description: 'Utilities',
            quantity: 1,
            unitPrice: 200,
            amount: 200,
            expenseAccountId: expense.id,
          },
        ],
      },
    },
  });
  const jePayBill2 = await postJournal('JE-SEED-006', 'Payment BILL-SEED-002', [
    { accountId: ap.id, debit: 200, credit: 0, description: 'AP payment' },
    { accountId: cash.id, debit: 0, credit: 200, description: 'Cash' },
  ]);
  await client.payment.create({
    data: {
      type: 'BILL',
      billId: bill2.id,
      amount: 200,
      date: seedDate,
      method: 'ACH',
      journalEntryId: jePayBill2.id,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
