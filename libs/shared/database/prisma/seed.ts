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

  const operatorRole = await prisma.role.upsert({
    where: { name: 'Operator' },
    update: {},
    create: { name: 'Operator' },
  });

  const supervisorRole = await prisma.role.upsert({
    where: { name: 'Supervisor' },
    update: {},
    create: { name: 'Supervisor' },
  });

  const inspectorRole = await prisma.role.upsert({
    where: { name: 'Inspector' },
    update: {},
    create: { name: 'Inspector' },
  });

  const technicianRole = await prisma.role.upsert({
    where: { name: 'Technician' },
    update: {},
    create: { name: 'Technician' },
  });

  const supportRole = await prisma.role.upsert({
    where: { name: 'Support' },
    update: {},
    create: { name: 'Support' },
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

  const operatorPasswordHash = await bcrypt.hash('Operator123!', 12);

  await prisma.user.upsert({
    where: { email: 'operator@arcncode.local' },
    update: {},
    create: {
      email: 'operator@arcncode.local',
      passwordHash: operatorPasswordHash,
      roles: {
        create: [{ roleId: operatorRole.id }],
      },
    },
  });

  const supervisorPasswordHash = await bcrypt.hash('Supervisor123!', 12);

  await prisma.user.upsert({
    where: { email: 'supervisor@arcncode.local' },
    update: {},
    create: {
      email: 'supervisor@arcncode.local',
      passwordHash: supervisorPasswordHash,
      roles: {
        create: [{ roleId: supervisorRole.id }],
      },
    },
  });

  const inspectorPasswordHash = await bcrypt.hash('Inspector123!', 12);

  await prisma.user.upsert({
    where: { email: 'inspector@arcncode.local' },
    update: {},
    create: {
      email: 'inspector@arcncode.local',
      passwordHash: inspectorPasswordHash,
      roles: {
        create: [{ roleId: inspectorRole.id }],
      },
    },
  });

  const technicianPasswordHash = await bcrypt.hash('Technician123!', 12);

  await prisma.user.upsert({
    where: { email: 'technician@arcncode.local' },
    update: {},
    create: {
      email: 'technician@arcncode.local',
      passwordHash: technicianPasswordHash,
      roles: {
        create: [{ roleId: technicianRole.id }],
      },
    },
  });

  const supportPasswordHash = await bcrypt.hash('Support123!', 12);

  await prisma.user.upsert({
    where: { email: 'support@arcncode.local' },
    update: {},
    create: {
      email: 'support@arcncode.local',
      passwordHash: supportPasswordHash,
      roles: {
        create: [{ roleId: supportRole.id }],
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
  await seedProcurement(prisma);
  await seedWorkforce(prisma);
  await seedMes(prisma);
  await seedQms(prisma);
  await seedCmms(prisma);
  await seedReturns(prisma, adminUser.id);
  await seedAnalytics(prisma);

  console.log('Seed complete:', {
    adminUserId: adminUser.id,
    roles: [
      adminRole.name,
      managerRole.name,
      viewerRole.name,
      operatorRole.name,
      supervisorRole.name,
      inspectorRole.name,
      technicianRole.name,
      supportRole.name,
    ],
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

/** Phase 10 — sample PO from approved requisition with receipt for scorecard. */
async function seedProcurement(client: PrismaClient): Promise<void> {
  const sentinel = 'PO-2026-SEED1';
  const existing = await client.purchaseOrder.findUnique({
    where: { poNumber: sentinel },
  });
  if (existing) return;

  const vendor = await client.vendor.findFirst({
    where: { name: 'Global Supplies Co', deletedAt: null },
  });
  const product = await client.product.findUnique({
    where: { sku: 'SKU-002' },
  });
  if (!vendor || !product) return;

  let requisition = await client.purchaseRequisition.findFirst({
    where: {
      componentProductId: product.id,
      status: 'APPROVED',
      purchaseOrderLine: null,
    },
  });

  if (!requisition) {
    requisition = await client.purchaseRequisition.create({
      data: {
        reqNumber: 'PR-2026-SEED-PO',
        componentProductId: product.id,
        quantity: 25,
        needByDate: new Date(),
        status: 'APPROVED',
        preferredVendorId: vendor.id,
      },
    });
  }

  const expectedDelivery = new Date();
  expectedDelivery.setUTCDate(expectedDelivery.getUTCDate() + 7);
  const unitPrice = product.listPrice ? Number(product.listPrice) : 79.5;
  const lineTotal = unitPrice * 25;

  const po = await client.purchaseOrder.create({
    data: {
      poNumber: sentinel,
      vendorId: vendor.id,
      status: 'ISSUED',
      expectedDeliveryDate: expectedDelivery,
      subtotal: lineTotal,
      total: lineTotal,
      lines: {
        create: [
          {
            productId: product.id,
            requisitionId: requisition.id,
            description: product.description,
            quantity: 25,
            unitPrice,
            lineTotal,
            expectedDeliveryDate: expectedDelivery,
            qtyReceived: 25,
          },
        ],
      },
    },
    include: { lines: true },
  });

  await client.purchaseRequisition.update({
    where: { id: requisition.id },
    data: { status: 'CONVERTED' },
  });

  const line = po.lines[0];
  const receivedAt = new Date(expectedDelivery);
  receivedAt.setUTCDate(receivedAt.getUTCDate() - 1);

  await client.poReceipt.create({
    data: {
      poLineId: line.id,
      quantity: 25,
      receivedAt,
    },
  });

  await client.vendorAcknowledgment.create({
    data: {
      poId: po.id,
      confirmedDeliveryDate: expectedDelivery,
      note: 'Seed vendor acknowledgment',
    },
  });
}

/** Phase 11 — sample employee, shift, assignment, and closed time entry. */
async function seedWorkforce(client: PrismaClient): Promise<void> {
  const existing = await client.employee.findUnique({
    where: { employeeNumber: 'EMP-0001' },
  });
  if (existing) return;

  const employee = await client.employee.create({
    data: {
      employeeNumber: 'EMP-0001',
      firstName: 'Alex',
      lastName: 'Assembler',
      department: 'Assembly',
      badgeCode: 'BADGE-0001',
      laborRate: 22.5,
      status: 'ACTIVE',
    },
  });

  const shift = await client.shift.upsert({
    where: { code: 'DAY' },
    create: {
      code: 'DAY',
      name: 'Day Shift',
      startTime: '07:00',
      endTime: '15:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      active: true,
    },
    update: {},
  });

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 1);

  let workingDay: Date | null = null;
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(start);
    candidate.setUTCDate(candidate.getUTCDate() + i);
    const calendarDay = await client.factoryCalendarDay.findUnique({
      where: { date: candidate },
    });
    if (calendarDay?.isWorkingDay && shift.daysOfWeek.includes(candidate.getUTCDay())) {
      workingDay = candidate;
      break;
    }
  }

  if (workingDay) {
    await client.shiftAssignment.upsert({
      where: {
        employeeId_date_shiftId: {
          employeeId: employee.id,
          date: workingDay,
          shiftId: shift.id,
        },
      },
      create: {
        employeeId: employee.id,
        shiftId: shift.id,
        date: workingDay,
      },
      update: {},
    });
  }

  const workOrder = await client.workOrder.findFirst({
    where: { woNumber: { contains: 'SEED' } },
  });
  if (!workOrder) return;

  const clockIn = new Date();
  clockIn.setUTCHours(8, 0, 0, 0);
  clockIn.setUTCDate(clockIn.getUTCDate() - 1);
  const clockOut = new Date(clockIn);
  clockOut.setUTCHours(12, 0, 0, 0);

  await client.timeEntry.create({
    data: {
      employeeId: employee.id,
      clockIn,
      clockOut,
      durationMinutes: 240,
      workOrderId: workOrder.id,
      department: employee.department,
      status: 'CLOSED',
    },
  });
}

/** Phase 12 — workstation, operations, and sample cycle on seeded work order. */
async function seedMes(client: PrismaClient): Promise<void> {
  const existing = await client.workstation.findUnique({
    where: { code: 'WS-LASER' },
  });
  if (existing) return;

  const workstation = await client.workstation.create({
    data: {
      code: 'WS-LASER',
      name: 'Laser Cutting Station',
      description: 'Primary laser workstation',
      status: 'ACTIVE',
    },
  });

  const workOrder = await client.workOrder.findFirst({
    where: { woNumber: { contains: 'SEED' } },
  });
  const employee = await client.employee.findUnique({
    where: { employeeNumber: 'EMP-0001' },
  });
  if (!workOrder || !employee) return;

  const op1 = await client.workOrderOperation.create({
    data: {
      workOrderId: workOrder.id,
      workstationId: workstation.id,
      sequence: 1,
      name: 'Laser Cut',
      status: 'COMPLETED',
      standardMinutes: 30,
    },
  });

  await client.workOrderOperation.create({
    data: {
      workOrderId: workOrder.id,
      workstationId: workstation.id,
      sequence: 2,
      name: 'Deburr',
      status: 'PENDING',
      standardMinutes: 15,
    },
  });

  const startedAt = new Date();
  startedAt.setUTCHours(9, 0, 0, 0);
  startedAt.setUTCDate(startedAt.getUTCDate() - 1);
  const endedAt = new Date(startedAt);
  endedAt.setUTCMinutes(endedAt.getUTCMinutes() + 25);

  await client.cycleRecord.create({
    data: {
      operationId: op1.id,
      employeeId: employee.id,
      startedAt,
      endedAt,
      durationMinutes: 25,
      quantityCompleted: 10,
      quantityScrapped: 0,
    },
  });
}

/** Phase 13 — inspection template and passing record on seeded work order. */
async function seedQms(client: PrismaClient): Promise<void> {
  const existing = await client.inspectionTemplate.findUnique({
    where: { code: 'TMPL-FINAL' },
  });
  if (existing) return;

  const admin = await client.user.findUnique({
    where: { email: 'admin@arcncode.local' },
  });
  const workOrder = await client.workOrder.findFirst({
    where: { woNumber: { contains: 'SEED' } },
  });
  if (!admin || !workOrder) return;

  const template = await client.inspectionTemplate.create({
    data: {
      code: 'TMPL-FINAL',
      name: 'Final Inspection',
      description: 'Standard final inspection checklist',
      active: true,
      criteria: {
        create: [
          {
            sequence: 1,
            label: 'Visual inspection',
            type: 'PASS_FAIL',
          },
          {
            sequence: 2,
            label: 'Critical dimension',
            type: 'MEASUREMENT',
            expectedMin: 9.5,
            expectedMax: 10.5,
            unit: 'mm',
          },
        ],
      },
    },
    include: { criteria: true },
  });

  const passFail = template.criteria.find((c) => c.sequence === 1)!;
  const measure = template.criteria.find((c) => c.sequence === 2)!;

  await client.inspectionRecord.create({
    data: {
      templateId: template.id,
      workOrderId: workOrder.id,
      inspectorUserId: admin.id,
      result: 'PASS',
      notes: 'Seed passing inspection',
      results: {
        create: [
          { criterionId: passFail.id, passed: true },
          { criterionId: measure.id, measuredValue: 10 },
        ],
      },
    },
  });
}

/** Phase 14 — asset linked to laser workstation, PM rules, corrective MWO. */
async function seedCmms(client: PrismaClient): Promise<void> {
  const existing = await client.asset.findUnique({
    where: { code: 'ASSET-LASER' },
  });
  if (existing) return;

  const workstation = await client.workstation.findUnique({
    where: { code: 'WS-LASER' },
  });
  if (!workstation) return;

  const asset = await client.asset.create({
    data: {
      code: 'ASSET-LASER',
      name: 'Laser Cutting Asset',
      description: 'Primary laser cutting equipment',
      workstationId: workstation.id,
      status: 'OPERATIONAL',
    },
  });

  await client.pmTriggerRule.create({
    data: {
      assetId: asset.id,
      type: 'CYCLE_COUNT',
      thresholdCycles: 100,
      active: true,
    },
  });

  const past = new Date();
  past.setUTCDate(past.getUTCDate() - 15);

  await client.pmTriggerRule.create({
    data: {
      assetId: asset.id,
      type: 'CALENDAR',
      intervalDays: 30,
      lastTriggeredAt: past,
      active: true,
    },
  });

  await client.maintenanceWorkOrder.create({
    data: {
      mwoNumber: `MWO-${new Date().getUTCFullYear()}-SEED`,
      assetId: asset.id,
      type: 'CORRECTIVE',
      status: 'OPEN',
      description: 'Replace worn laser nozzle',
      scheduledDate: new Date(),
    },
  });
}

/** Phase 15 — Returns location, RET-01 bin, sample RMA against shipped SO line. */
async function seedReturns(
  client: PrismaClient,
  adminUserId: string,
): Promise<void> {
  const seedRmaNumber = `RMA-${new Date().getUTCFullYear()}-SEED`;
  const existingRma = await client.rma.findUnique({
    where: { rmaNumber: seedRmaNumber },
  });
  if (existingRma) return;

  let returnsLocation = await client.location.findUnique({
    where: { code: 'RETURNS' },
  });
  if (!returnsLocation) {
    returnsLocation = await client.location.create({
      data: {
        code: 'RETURNS',
        name: 'Returns Warehouse',
        type: 'returns',
      },
    });
  }

  let returnsBin = await client.bin.findUnique({ where: { code: 'RET-01' } });
  if (!returnsBin) {
    returnsBin = await client.bin.create({
      data: {
        code: 'RET-01',
        locationId: returnsLocation.id,
      },
    });
  }

  const order = await client.salesOrder.findUnique({
    where: { orderNumber: 'SO-SEED-001' },
    include: {
      lines: {
        where: { kind: 'PRODUCT' },
        orderBy: { lineNumber: 'asc' },
      },
      shipments: true,
    },
  });
  if (!order || order.lines.length === 0) return;

  const line = order.lines[0]!;
  const qtyShipped = Number(line.qtyShipped);

  if (qtyShipped <= 0) {
    const shipQty = Math.min(5, Number(line.qtyOrdered));
    await client.salesOrderLine.update({
      where: { id: line.id },
      data: { qtyShipped: shipQty },
    });

    const newStatus =
      shipQty >= Number(line.qtyOrdered) ? 'SHIPPED' : 'PARTIALLY_SHIPPED';
    await client.salesOrder.update({
      where: { id: order.id },
      data: { status: newStatus },
    });

    await client.salesOrderShipment.create({
      data: {
        orderId: order.id,
        shipmentNumber: 'SHP-SEED-001',
        shippedAt: new Date(),
        lines: [{ lineId: line.id, quantity: shipQty }],
      },
    });
  }

  const supportUser = await client.user.findUnique({
    where: { email: 'support@arcncode.local' },
  });

  await client.rma.create({
    data: {
      rmaNumber: seedRmaNumber,
      salesOrderId: order.id,
      salesOrderLineId: line.id,
      customerId: order.customerId,
      reasonCode: 'DEFECTIVE',
      status: 'REQUESTED',
      quantity: 1,
      qualityRelated: true,
      notes: 'Sample seed RMA for demo',
      requestedByUserId: supportUser?.id ?? adminUserId,
    },
  });
}

/** Phase 16 — analytics events, WIP pileup demo, sample inventory forecast. */
async function seedAnalytics(client: PrismaClient): Promise<void> {
  const guard = await client.analyticsEvent.findUnique({
    where: { dedupeKey: 'SEED-ANALYTICS-GUARD' },
  });
  if (guard) return;

  const now = new Date();
  const sampleTopics = [
    'masterdata.product.created',
    'sales.order.shipped',
    'mes.cycle.recorded',
    'qms.scrap.reported',
    'returns.rma.requested',
    'finance.invoice.posted',
  ];

  for (const topic of sampleTopics) {
    const module = topic.split('.')[0] ?? 'unknown';
    await client.analyticsEvent.create({
      data: {
        topic,
        module,
        entityId: `seed-${topic}`,
        occurredAt: now,
        payload: { seed: true },
        dedupeKey:
          topic === sampleTopics[0]
            ? 'SEED-ANALYTICS-GUARD'
            : `SEED-ANALYTICS-${topic}`,
      },
    });
  }

  const workstation = await client.workstation.findUnique({
    where: { code: 'WS-LASER' },
  });
  if (workstation) {
    const workOrders = await client.workOrder.findMany({ take: 4 });
    for (let i = 0; i < workOrders.length; i++) {
      const wo = workOrders[i]!;
      await client.workOrderOperation.upsert({
        where: {
          workOrderId_sequence: { workOrderId: wo.id, sequence: 80 + i },
        },
        create: {
          workOrderId: wo.id,
          workstationId: workstation.id,
          sequence: 80 + i,
          name: `Seed analytics pileup ${i}`,
          status: 'IN_PROGRESS',
        },
        update: {
          workstationId: workstation.id,
          status: 'IN_PROGRESS',
        },
      });
    }
  }

  const product = await client.product.findUnique({ where: { sku: 'SKU-001' } });
  if (product) {
    const asOf = new Date();
    asOf.setUTCHours(0, 0, 0, 0);
    const inv = await client.inventoryQuantity.findFirst({
      where: { productId: product.id },
    });
    const onHand = inv ? Number(inv.onHand) : 100;

    await client.inventoryForecast.upsert({
      where: {
        productId_asOfDate: { productId: product.id, asOfDate: asOf },
      },
      create: {
        productId: product.id,
        asOfDate: asOf,
        avgDailyDemand: 2.5,
        onHand,
        projectedDepletionDate: new Date(asOf.getTime() + 20 * 86400000),
        recommendedReorderDate: new Date(asOf.getTime() + 15 * 86400000),
        leadTimeDays: product.leadTimeDays || 5,
      },
      update: {},
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
