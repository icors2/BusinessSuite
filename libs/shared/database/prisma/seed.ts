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
    update: { listPrice: 49.99 },
    create: {
      sku: 'SKU-001',
      description: 'Sample Widget A',
      unitOfMeasure: 'EA',
      category: 'Widgets',
      listPrice: 49.99,
    },
  });

  await prisma.product.upsert({
    where: { sku: 'SKU-002' },
    update: { listPrice: 79.5 },
    create: {
      sku: 'SKU-002',
      description: 'Sample Widget B',
      unitOfMeasure: 'EA',
      category: 'Widgets',
      listPrice: 79.5,
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

  let customerId: string;
  if (!customer) {
    const created = await prisma.customer.create({
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
        priceTier: 'preferred',
      },
    });
    customerId = created.id;
  } else {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { priceTier: 'preferred' },
    });
    customerId = customer.id;
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
  await seedCpq(prisma, customerId);
  await seedSales(prisma, customerId);
  await seedMps(prisma);
  await seedMrp(prisma);

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

/** Phase 6 — CPQ catalog, settings, and sample draft quote. */
async function seedCpq(client: PrismaClient, customerId: string): Promise<void> {
  const demoMaterials = [
    {
      itemNumber: 'S-P0063-3003',
      description: 'PLATE .063" X 4\' X 8\' 3003',
      standardCost: 4,
      uom: 29,
      uomProcess: 4018,
      cutSpeedInMin: 519,
      pierceTimeSecs: 0.5,
    },
    {
      itemNumber: 'S-S11GA-A1011',
      description: "SHEET 11GA X 4' X 8' A1011",
      standardCost: 0.55,
      uom: 160,
      uomProcess: 4018,
      cutSpeedInMin: 417,
      pierceTimeSecs: 0.5,
    },
    {
      itemNumber: 'S-P0090-5052',
      description: 'PLATE .090" X 4\' X 10\' 5052',
      standardCost: 4,
      uom: 29,
      uomProcess: 4018,
      cutSpeedInMin: 450,
      pierceTimeSecs: 0.5,
    },
    {
      itemNumber: 'S-A05000500012520-A36',
      description: 'ANGLE BAR 1/2" X 1/2" X 1/8" WL',
      standardCost: 0.405,
      uom: 240,
      uomProcess: 240,
      cutSpeedInMin: 0,
      pierceTimeSecs: 0,
    },
  ];

  for (const m of demoMaterials) {
    await client.cpqMaterial.upsert({
      where: { itemNumber: m.itemNumber },
      update: m,
      create: m,
    });
  }

  const demoParts = [
    {
      itemNumber: '109002-M01',
      description: 'PLYO RUBBER TOP',
      itemType: 'Sales Inventory',
      source: 'purchased',
      standardCost: 6.59,
    },
    {
      itemNumber: 'PEM-1032',
      description: 'PEM NUT 10-32',
      itemType: 'Purchased',
      source: 'purchased',
      standardCost: 0.85,
    },
  ];

  for (const p of demoParts) {
    await client.cpqCatalogPart.upsert({
      where: { itemNumber: p.itemNumber },
      update: p,
      create: p,
    });
  }

  await client.cpqSetting.upsert({
    where: { key: 'rate_card' },
    update: {},
    create: {
      key: 'rate_card',
      value: {
        materialMargin: 0.7,
        laborMargin: 0.7,
        ratesPerMin: {
          laser: 2.205,
          tube_laser: 2.1243,
          saw: 1.0965,
          drill: 1.097,
          tap: 1.097,
          machine: 1.0965,
          weld: 1.0425,
          powder: 6.324,
          blast: 1,
          press: 0.8288,
        },
      },
    },
  });

  await client.cpqSetting.upsert({
    where: { key: 'pricing_config' },
    update: {},
    create: {
      key: 'pricing_config',
      value: {
        setupBaseCost: 85,
        extraMargin: 0,
        priceRounding: 0.25,
        quantityBreaks: [1, 2, 3, 5, 10, 25, 50, 100],
        tierDiscounts: { standard: 0, preferred: 5, strategic: 10 },
        volumeBreaks: [
          { minQty: 1, discountPct: 0 },
          { minQty: 10, discountPct: 2 },
          { minQty: 25, discountPct: 5 },
        ],
      },
    },
  });

  const existingQuote = await client.quote.findUnique({
    where: { quoteNumber: 'Q-SEED-CPQ-001' },
  });
  if (existingQuote) return;

  const product = await client.product.findUniqueOrThrow({
    where: { sku: 'SKU-001' },
  });

  await client.quote.create({
    data: {
      quoteNumber: 'Q-SEED-CPQ-001',
      customerId,
      status: 'DRAFT',
      notes: 'Sample CPQ quote (product + fabricated plate)',
      currency: 'USD',
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: product.id,
            description: product.description,
            quantity: 5,
            unitPrice: 47.49,
            discountPct: 5,
            lineTotal: 237.45,
          },
          {
            lineNumber: 2,
            kind: 'FABRICATED',
            description: 'Base plate bracket',
            quantity: 1,
            unitPrice: 0,
            discountPct: 0,
            lineTotal: 0,
            fabInput: {
              kind: 'plate',
              name: 'Base plate',
              material: 'S-P0063-3003',
              length: 10,
              width: 6,
              drillFeatures: 2,
            },
          },
        ],
      },
      subtotal: 237.45,
      discountTotal: 0,
      total: 237.45,
    },
  });
}

/** Phase 7 — sample sales order from accepted quote (product + fabricated MTO). */
async function seedSales(
  client: PrismaClient,
  customerId: string,
): Promise<void> {
  const existing = await client.salesOrder.findUnique({
    where: { orderNumber: 'SO-SEED-001' },
  });
  if (existing) return;

  const product = await client.product.findUniqueOrThrow({
    where: { sku: 'SKU-001' },
  });

  const bin = await client.bin.findUnique({ where: { code: 'A-01-01' } });
  const inv = bin
    ? await client.inventoryQuantity.findUnique({
        where: {
          productId_binId: { productId: product.id, binId: bin.id },
        },
      })
    : null;
  const onHand = inv ? Number(inv.onHand) : 0;
  const allocated = inv ? Number(inv.allocated) : 0;
  const available = Math.max(0, onHand - allocated);

  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const quote = await client.quote.upsert({
    where: { quoteNumber: 'Q-SEED-SO-SOURCE' },
    update: { status: 'ACCEPTED' },
    create: {
      quoteNumber: 'Q-SEED-SO-SOURCE',
      customerId,
      status: 'ACCEPTED',
      validUntil,
      currency: 'USD',
      subtotal: 474.9,
      total: 474.9,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: product.id,
            description: product.description,
            quantity: 10,
            unitPrice: 47.49,
            lineTotal: 474.9,
          },
          {
            lineNumber: 2,
            kind: 'FABRICATED',
            description: 'Bracket assembly (make-to-order)',
            quantity: 1,
            unitPrice: 95,
            lineTotal: 95,
            fabInput: {
              kind: 'plate',
              name: 'Bracket',
              material: 'S-P0063-3003',
              length: 8,
              width: 4,
            },
          },
        ],
      },
    },
  });

  const qtyOrdered = 10;
  const qtyAllocated = Math.min(qtyOrdered, available);
  const qtyBackordered = Math.max(0, qtyOrdered - qtyAllocated);

  const allocationDetails =
    bin && qtyAllocated > 0
      ? [{ binId: bin.id, binCode: bin.code, quantity: qtyAllocated }]
      : [];

  if (bin && qtyAllocated > 0) {
    await client.inventoryQuantity.update({
      where: {
        productId_binId: { productId: product.id, binId: bin.id },
      },
      data: { allocated: { increment: qtyAllocated } },
    });
  }

  await client.salesOrder.create({
    data: {
      orderNumber: 'SO-SEED-001',
      quoteId: quote.id,
      customerId,
      status: qtyBackordered > 0 ? 'BACKORDERED' : 'ALLOCATED',
      currency: 'USD',
      subtotal: 569.9,
      total: 569.9,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: product.id,
            description: product.description,
            unitPrice: 47.49,
            qtyOrdered,
            qtyAllocated,
            qtyBackordered,
            lineTotal: 474.9,
            allocationDetails,
          },
          {
            lineNumber: 2,
            kind: 'FABRICATED',
            description: 'Bracket assembly (make-to-order)',
            unitPrice: 95,
            qtyOrdered: 1,
            toProduce: true,
            lineTotal: 95,
          },
        ],
      },
    },
  });
}

/** Phase 8 — factory calendar, production line, and sample work orders. */
async function seedMps(client: PrismaClient): Promise<void> {
  const existingLine = await client.productionLine.findUnique({
    where: { code: 'LINE-MAIN' },
  });
  if (existingLine) return;

  const line = await client.productionLine.create({
    data: {
      code: 'LINE-MAIN',
      name: 'Main Assembly Line',
      capacityPerDay: 50,
      active: true,
    },
  });

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const day = date.getUTCDay();
    await client.factoryCalendarDay.upsert({
      where: { date },
      create: {
        date,
        isWorkingDay: day !== 0 && day !== 6,
      },
      update: {},
    });
  }

  await client.mpsSetting.upsert({
    where: { scope: 'GLOBAL' },
    create: { scope: 'GLOBAL', strategy: 'WEEKLY' },
    update: {},
  });

  const product = await client.product.findUnique({
    where: { sku: 'SKU-001' },
  });
  if (!product) return;

  await client.product.update({
    where: { id: product.id },
    data: { mpsStrategy: 'WEEKLY' },
  });

  const salesLine = await client.salesOrderLine.findFirst({
    where: {
      productId: product.id,
      order: { orderNumber: 'SO-SEED-001' },
    },
  });
  if (!salesLine) return;

  const qty = Math.max(
    0,
    Number(salesLine.qtyOrdered) - Number(salesLine.qtyShipped),
  );
  if (qty <= 0) return;

  const periodStart = new Date(start);
  const periodEnd = new Date(start);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 4);

  await client.workOrder.create({
    data: {
      woNumber: `WO-${new Date().getFullYear()}-SEED1`,
      productId: product.id,
      lineId: line.id,
      quantity: qty,
      scheduledStart: periodStart,
      scheduledEnd: periodEnd,
      status: 'PROPOSED',
      strategy: 'WEEKLY',
      periodKey: `${periodStart.getUTCFullYear()}-W${String(
        Math.ceil(
          ((periodStart.getTime() - Date.UTC(periodStart.getUTCFullYear(), 0, 1)) /
            86400000 +
            1) /
            7,
        ),
      ).padStart(2, '0')}`,
      demandRefs: [salesLine.id],
    },
  });
}

/** Phase 9 — BOM, procurement types, and sample MRP data. */
async function seedMrp(client: PrismaClient): Promise<void> {
  const assembly = await client.product.findUnique({
    where: { sku: 'SKU-001' },
  });
  const buyComponent = await client.product.findUnique({
    where: { sku: 'SKU-002' },
  });
  if (!assembly || !buyComponent) return;

  const existingBom = await client.billOfMaterials.findUnique({
    where: { productId: assembly.id },
  });
  if (existingBom) return;

  const vendor = await client.vendor.findFirst({
    where: { name: 'Global Supplies Co', deletedAt: null },
  });
  if (!vendor) return;

  await client.vendor.update({
    where: { id: vendor.id },
    data: { leadTimeDays: 14 },
  });

  await client.product.update({
    where: { id: assembly.id },
    data: { procurementType: 'MAKE' },
  });

  let subAsm = await client.product.findUnique({
    where: { sku: 'SKU-SUB-001' },
  });
  if (!subAsm) {
    subAsm = await client.product.create({
      data: {
        sku: 'SKU-SUB-001',
        description: 'Widget A sub-assembly',
        unitOfMeasure: 'EA',
        procurementType: 'MAKE',
      },
    });
  }

  await client.product.update({
    where: { id: buyComponent.id },
    data: {
      procurementType: 'BUY',
      leadTimeDays: 7,
      preferredVendorId: vendor.id,
    },
  });

  let buyFastener = await client.product.findUnique({
    where: { sku: 'SKU-FAST-001' },
  });
  if (!buyFastener) {
    buyFastener = await client.product.create({
      data: {
        sku: 'SKU-FAST-001',
        description: 'Mounting fastener kit',
        unitOfMeasure: 'EA',
        procurementType: 'BUY',
        leadTimeDays: 3,
        preferredVendorId: vendor.id,
      },
    });
  }

  await client.billOfMaterials.create({
    data: {
      productId: subAsm.id,
      active: true,
      lines: {
        create: [
          {
            componentProductId: buyComponent.id,
            quantityPer: 2,
            scrapFactor: 0.05,
          },
        ],
      },
    },
  });

  await client.billOfMaterials.create({
    data: {
      productId: assembly.id,
      active: true,
      lines: {
        create: [
          {
            componentProductId: subAsm.id,
            quantityPer: 1,
            scrapFactor: 0,
          },
          {
            componentProductId: buyFastener.id,
            quantityPer: 4,
            scrapFactor: 0.1,
          },
        ],
      },
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
