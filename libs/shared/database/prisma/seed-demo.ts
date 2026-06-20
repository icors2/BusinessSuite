/**
 * Phase 18 — comprehensive demo seed.
 * Runs base seed (roles, users, minimal data) then enriches cross-module scenarios.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { seedMain } from './seed';
import { DEMO, daysAgo, daysFromNow, utcMidnight } from './seed-helpers';

const prisma = new PrismaClient();

async function isDemoSeeded(): Promise<boolean> {
  const order = await prisma.salesOrder.findUnique({
    where: { orderNumber: DEMO.SO_SHIPPED },
  });
  return order?.status === 'SHIPPED';
}

async function seedDemoErp(client: PrismaClient): Promise<{
  vendorPartsId: string;
  customerGlobexId: string;
  skuMakeId: string;
  skuBuyId: string;
  skuFinishedId: string;
}> {
  const vendorParts =
    (await client.vendor.findFirst({
      where: { name: DEMO.VENDOR_PARTS, deletedAt: null },
    })) ??
    (await client.vendor.create({
      data: {
        name: DEMO.VENDOR_PARTS,
        email: 'orders@precisionparts.example',
        phone: '555-0200',
        paymentTerms: 'Net 30',
      },
    }));

  const customerGlobex =
    (await client.customer.findFirst({
      where: { name: DEMO.CUSTOMER_GLOBEX, deletedAt: null },
    })) ??
    (await client.customer.create({
      data: {
        name: DEMO.CUSTOMER_GLOBEX,
        email: 'procurement@globex.example',
        phone: '555-0300',
        creditTerms: 'Net 45',
        priceTier: 'standard',
      },
    }));

  const skuMake = await client.product.upsert({
    where: { sku: DEMO.SKU_MAKE },
    update: { procurementType: 'MAKE', listPrice: 129.99 },
    create: {
      sku: DEMO.SKU_MAKE,
      description: 'Demo Assembly (make)',
      unitOfMeasure: 'EA',
      category: 'Assemblies',
      listPrice: 129.99,
      procurementType: 'MAKE',
      mpsStrategy: 'WEEKLY',
      leadTimeDays: 7,
    },
  });

  const skuBuy = await client.product.upsert({
    where: { sku: DEMO.SKU_BUY },
    update: {
      procurementType: 'BUY',
      preferredVendorId: vendorParts.id,
      leadTimeDays: 14,
    },
    create: {
      sku: DEMO.SKU_BUY,
      description: 'Demo Raw Material (buy)',
      unitOfMeasure: 'EA',
      category: 'Raw',
      listPrice: 12.5,
      procurementType: 'BUY',
      preferredVendorId: vendorParts.id,
      leadTimeDays: 14,
    },
  });

  const skuFinished = await client.product.upsert({
    where: { sku: DEMO.SKU_FINISHED },
    update: { listPrice: 249.99 },
    create: {
      sku: DEMO.SKU_FINISHED,
      description: 'Demo Finished Good',
      unitOfMeasure: 'EA',
      category: 'Finished',
      listPrice: 249.99,
      procurementType: 'MAKE',
      mpsStrategy: 'MONTHLY',
      leadTimeDays: 5,
    },
  });

  await client.billOfMaterials.upsert({
    where: { productId: skuMake.id },
    update: {},
    create: {
      productId: skuMake.id,
      lines: {
        create: [
          {
            componentProductId: skuBuy.id,
            quantityPer: 4,
          },
        ],
      },
    },
  });

  return {
    vendorPartsId: vendorParts.id,
    customerGlobexId: customerGlobex.id,
    skuMakeId: skuMake.id,
    skuBuyId: skuBuy.id,
    skuFinishedId: skuFinished.id,
  };
}

async function seedDemoWms(
  client: PrismaClient,
  productIds: { skuMakeId: string; skuBuyId: string; skuFinishedId: string },
): Promise<{ binDemoId: string; binMainId: string }> {
  const main = await client.location.findUniqueOrThrow({ where: { code: 'MAIN' } });
  const binMain = await client.bin.findUniqueOrThrow({ where: { code: 'A-01-01' } });

  const binDemo = await client.bin.upsert({
    where: { code: DEMO.BIN_DEMO },
    update: {},
    create: {
      locationId: main.id,
      code: DEMO.BIN_DEMO,
      description: 'Demo staging bin',
    },
  });

  for (const [productId, qty] of [
    [productIds.skuMakeId, 40],
    [productIds.skuBuyId, 200],
    [productIds.skuFinishedId, 25],
  ] as const) {
    await client.inventoryQuantity.upsert({
      where: { productId_binId: { productId, binId: binDemo.id } },
      update: { onHand: qty, allocated: 0 },
      create: { productId, binId: binDemo.id, onHand: qty, allocated: 0 },
    });
  }

  return { binDemoId: binDemo.id, binMainId: binMain.id };
}

async function seedDemoPlm(client: PrismaClient, skuMakeId: string): Promise<void> {
  const existing = await client.document.findFirst({
    where: { productId: skuMakeId, name: 'Demo Assembly Drawing' },
  });
  if (existing) return;

  const revReleased = randomUUID();
  const doc = await client.document.create({
    data: {
      productId: skuMakeId,
      name: 'Demo Assembly Drawing',
      docType: 'drawing',
      revisions: {
        create: {
          id: revReleased,
          revisionNumber: 1,
          status: 'RELEASED',
          fileName: 'demo-assembly-v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          objectKey: `documents/demo/${revReleased}.pdf`,
        },
      },
    },
    include: { revisions: true },
  });
  await client.document.update({
    where: { id: doc.id },
    data: { currentRevisionId: doc.revisions[0]!.id },
  });

  const revReview = randomUUID();
  const doc2 = await client.document.create({
    data: {
      productId: skuMakeId,
      name: 'Demo Work Instruction',
      docType: 'work_instruction',
      revisions: {
        create: {
          id: revReview,
          revisionNumber: 1,
          status: 'IN_REVIEW',
          fileName: 'demo-wi-v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 512,
          objectKey: `documents/demo/${revReview}.pdf`,
        },
      },
    },
    include: { revisions: true },
  });
  await client.document.update({
    where: { id: doc2.id },
    data: { currentRevisionId: doc2.revisions[0]!.id },
  });
}

async function seedDemoCpq(
  client: PrismaClient,
  customerGlobexId: string,
  skuFinishedId: string,
): Promise<{ quoteAcceptedId: string }> {
  const validUntil = daysFromNow(365);

  await client.quote.upsert({
    where: { quoteNumber: DEMO.Q_DRAFT },
    update: {},
    create: {
      quoteNumber: DEMO.Q_DRAFT,
      customerId: customerGlobexId,
      status: 'DRAFT',
      validUntil,
      currency: 'USD',
      subtotal: 499.98,
      total: 499.98,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: skuFinishedId,
            description: 'Demo Finished Good',
            quantity: 2,
            unitPrice: 249.99,
            lineTotal: 499.98,
          },
        ],
      },
    },
  });

  await client.quote.upsert({
    where: { quoteNumber: DEMO.Q_SENT },
    update: {},
    create: {
      quoteNumber: DEMO.Q_SENT,
      customerId: customerGlobexId,
      status: 'SENT',
      validUntil,
      sentAt: daysAgo(3),
      currency: 'USD',
      subtotal: 249.99,
      total: 249.99,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: skuFinishedId,
            description: 'Demo Finished Good',
            quantity: 1,
            unitPrice: 249.99,
            lineTotal: 249.99,
          },
        ],
      },
    },
  });

  const accepted = await client.quote.upsert({
    where: { quoteNumber: DEMO.Q_ACCEPTED },
    update: { status: 'ACCEPTED' },
    create: {
      quoteNumber: DEMO.Q_ACCEPTED,
      customerId: customerGlobexId,
      status: 'ACCEPTED',
      validUntil,
      sentAt: daysAgo(7),
      currency: 'USD',
      subtotal: 749.97,
      total: 749.97,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: skuFinishedId,
            description: 'Demo Finished Good',
            quantity: 3,
            unitPrice: 249.99,
            lineTotal: 749.97,
          },
        ],
      },
    },
  });

  return { quoteAcceptedId: accepted.id };
}

async function seedDemoSales(
  client: PrismaClient,
  ctx: {
    customerGlobexId: string;
    skuFinishedId: string;
    skuMakeId: string;
    quoteAcceptedId: string;
    binDemoId: string;
  },
): Promise<{ shippedLineId: string; allocatedOrderId: string }> {
  const acme = await client.customer.findFirstOrThrow({
    where: { name: 'Acme Manufacturing', deletedAt: null },
  });

  const shippedExists = await client.salesOrder.findUnique({
    where: { orderNumber: DEMO.SO_SHIPPED },
  });
  if (shippedExists) {
    const line = await client.salesOrderLine.findFirstOrThrow({
      where: { orderId: shippedExists.id, lineNumber: 1 },
    });
    const alloc = await client.salesOrder.findUniqueOrThrow({
      where: { orderNumber: DEMO.SO_ALLOCATED },
    });
    return { shippedLineId: line.id, allocatedOrderId: alloc.id };
  }

  const shipQty = 5;
  const unitPrice = 249.99;
  const lineTotal = unitPrice * shipQty;

  await client.inventoryQuantity.update({
    where: {
      productId_binId: {
        productId: ctx.skuFinishedId,
        binId: ctx.binDemoId,
      },
    },
    data: { onHand: { decrement: shipQty } },
  });

  const shippedOrder = await client.salesOrder.create({
    data: {
      orderNumber: DEMO.SO_SHIPPED,
      customerId: acme.id,
      status: 'SHIPPED',
      currency: 'USD',
      subtotal: lineTotal,
      total: lineTotal,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: ctx.skuFinishedId,
            description: 'Demo Finished Good (shipped)',
            unitPrice,
            qtyOrdered: shipQty,
            qtyAllocated: shipQty,
            qtyShipped: shipQty,
            lineTotal,
          },
        ],
      },
    },
    include: { lines: true },
  });

  const shippedLine = shippedOrder.lines[0]!;
  const revenue = await client.account.findUniqueOrThrow({ where: { code: '4000' } });
  const ar = await client.account.findUniqueOrThrow({ where: { code: '1100' } });
  const jeInv = await client.journalEntry.create({
    data: {
      entryNumber: 'JE-DEMO-001',
      date: daysAgo(2),
      memo: `Invoice ${DEMO.INV_SHIPPED}`,
      status: 'POSTED',
      postedAt: daysAgo(2),
      lines: {
        create: [
          { accountId: ar.id, debit: lineTotal, credit: 0, description: 'AR' },
          { accountId: revenue.id, debit: 0, credit: lineTotal, description: 'Revenue' },
        ],
      },
    },
  });

  const invoice = await client.invoice.create({
    data: {
      invoiceNumber: DEMO.INV_SHIPPED,
      customerId: acme.id,
      issueDate: daysAgo(2),
      dueDate: daysFromNow(28),
      status: 'OPEN',
      total: lineTotal,
      journalEntryId: jeInv.id,
      lines: {
        create: [
          {
            description: shippedLine.description,
            quantity: shipQty,
            unitPrice,
            amount: lineTotal,
          },
        ],
      },
    },
  });

  await client.salesOrderShipment.create({
    data: {
      orderId: shippedOrder.id,
      shipmentNumber: 'SHP-DEMO-001',
      invoiceId: invoice.id,
      shippedAt: daysAgo(2),
      lines: [{ lineId: shippedLine.id, quantity: shipQty }],
    },
  });

  const allocQty = 3;
  await client.inventoryQuantity.update({
    where: {
      productId_binId: {
        productId: ctx.skuFinishedId,
        binId: ctx.binDemoId,
      },
    },
    data: { allocated: { increment: allocQty } },
  });

  const allocatedOrder = await client.salesOrder.create({
    data: {
      orderNumber: DEMO.SO_ALLOCATED,
      quoteId: ctx.quoteAcceptedId,
      customerId: ctx.customerGlobexId,
      status: 'ALLOCATED',
      currency: 'USD',
      subtotal: unitPrice * allocQty + 95,
      total: unitPrice * allocQty + 95,
      lines: {
        create: [
          {
            lineNumber: 1,
            kind: 'PRODUCT',
            productId: ctx.skuFinishedId,
            description: 'Demo Finished Good',
            unitPrice,
            qtyOrdered: allocQty,
            qtyAllocated: allocQty,
            lineTotal: unitPrice * allocQty,
            allocationDetails: [
              { binId: ctx.binDemoId, binCode: DEMO.BIN_DEMO, quantity: allocQty },
            ],
          },
          {
            lineNumber: 2,
            kind: 'FABRICATED',
            description: 'Custom bracket (MTO)',
            unitPrice: 95,
            qtyOrdered: 1,
            toProduce: true,
            lineTotal: 95,
          },
        ],
      },
    },
  });

  return {
    shippedLineId: shippedLine.id,
    allocatedOrderId: allocatedOrder.id,
  };
}

async function seedDemoFinance(
  client: PrismaClient,
  vendorPartsId: string,
): Promise<void> {
  const existing = await client.bill.findUnique({
    where: { billNumber: DEMO.BILL_DEMO },
  });
  if (existing) return;

  const expense = await client.account.findUniqueOrThrow({ where: { code: '5000' } });
  const ap = await client.account.findUniqueOrThrow({ where: { code: '2000' } });
  const total = 500;

  const jeBill = await client.journalEntry.create({
    data: {
      entryNumber: 'JE-DEMO-002',
      date: daysAgo(10),
      memo: `Bill ${DEMO.BILL_DEMO}`,
      status: 'POSTED',
      postedAt: daysAgo(10),
      lines: {
        create: [
          { accountId: expense.id, debit: total, credit: 0, description: 'Expense' },
          { accountId: ap.id, debit: 0, credit: total, description: 'AP' },
        ],
      },
    },
  });

  await client.bill.create({
    data: {
      billNumber: DEMO.BILL_DEMO,
      vendorId: vendorPartsId,
      issueDate: daysAgo(10),
      dueDate: daysFromNow(20),
      status: 'OPEN',
      total,
      journalEntryId: jeBill.id,
      lines: {
        create: [
          {
            description: 'Demo raw material purchase',
            quantity: 40,
            unitPrice: 12.5,
            amount: total,
            expenseAccountId: expense.id,
          },
        ],
      },
    },
  });
}

async function seedDemoMpsMrp(
  client: PrismaClient,
  skuMakeId: string,
  skuBuyId: string,
  vendorPartsId: string,
): Promise<{ workOrderId: string }> {
  const line = await client.productionLine.findUniqueOrThrow({
    where: { code: 'LINE-MAIN' },
  });

  const existingWo = await client.workOrder.findUnique({
    where: { woNumber: DEMO.WO_DEMO },
  });
  if (existingWo) {
    return { workOrderId: existingWo.id };
  }

  const periodKey = `${new Date().getUTCFullYear()}-DEMO`;
  const wo = await client.workOrder.create({
    data: {
      woNumber: DEMO.WO_DEMO,
      productId: skuMakeId,
      lineId: line.id,
      quantity: 10,
      status: 'IN_PROGRESS',
      scheduledStart: daysFromNow(1),
      scheduledEnd: daysFromNow(3),
      strategy: 'WEEKLY',
      periodKey,
    },
  });

  await client.purchaseRequisition.upsert({
    where: { reqNumber: DEMO.PR_PENDING },
    update: {},
    create: {
      reqNumber: DEMO.PR_PENDING,
      componentProductId: skuBuyId,
      quantity: 50,
      needByDate: daysFromNow(14),
      status: 'PENDING',
      preferredVendorId: vendorPartsId,
    },
  });

  await client.purchaseRequisition.upsert({
    where: { reqNumber: DEMO.PR_APPROVED },
    update: {},
    create: {
      reqNumber: DEMO.PR_APPROVED,
      componentProductId: skuBuyId,
      quantity: 100,
      needByDate: daysFromNow(7),
      status: 'APPROVED',
      preferredVendorId: vendorPartsId,
    },
  });

  return { workOrderId: wo.id };
}

async function seedDemoProcurement(
  client: PrismaClient,
  skuBuyId: string,
  vendorPartsId: string,
): Promise<void> {
  if (await client.purchaseOrder.findUnique({ where: { poNumber: DEMO.PO_PARTIAL } })) {
    return;
  }

  const approved = await client.purchaseRequisition.findUniqueOrThrow({
    where: { reqNumber: DEMO.PR_APPROVED },
  });

  const unitPrice = 12.5;
  const qty = 100;
  const po1 = await client.purchaseOrder.create({
    data: {
      poNumber: DEMO.PO_PARTIAL,
      vendorId: vendorPartsId,
      status: 'ISSUED',
      expectedDeliveryDate: daysFromNow(7),
      subtotal: unitPrice * qty,
      total: unitPrice * qty,
      lines: {
        create: [
          {
            productId: skuBuyId,
            requisitionId: approved.id,
            description: 'Demo raw material',
            quantity: qty,
            unitPrice,
            lineTotal: unitPrice * qty,
            qtyReceived: 40,
          },
        ],
      },
    },
    include: { lines: true },
  });

  await client.poReceipt.create({
    data: {
      poLineId: po1.lines[0]!.id,
      quantity: 40,
      receivedAt: daysAgo(1),
    },
  });

  await client.purchaseRequisition.update({
    where: { id: approved.id },
    data: { status: 'CONVERTED' },
  });

  await client.purchaseOrder.create({
    data: {
      poNumber: DEMO.PO_ASN,
      vendorId: vendorPartsId,
      status: 'ACKNOWLEDGED',
      expectedDeliveryDate: daysFromNow(5),
      subtotal: 250,
      total: 250,
      lines: {
        create: [
          {
            productId: skuBuyId,
            description: 'Demo ASN pending line',
            quantity: 20,
            unitPrice: 12.5,
            lineTotal: 250,
          },
        ],
      },
    },
  });
}

async function seedDemoWorkforce(
  client: PrismaClient,
  workOrderId: string,
): Promise<{ employeeId: string }> {
  const employee = await client.employee.upsert({
    where: { employeeNumber: 'EMP-DEMO-01' },
    update: {},
    create: {
      employeeNumber: 'EMP-DEMO-01',
      firstName: 'Demo',
      lastName: 'Operator',
      department: 'Assembly',
      badgeCode: 'BADGE-DEMO',
      laborRate: 25,
      status: 'ACTIVE',
    },
  });

  const openEntry = await client.timeEntry.findFirst({
    where: { employeeId: employee.id, status: 'OPEN' },
  });
  if (!openEntry) {
    await client.timeEntry.create({
      data: {
        employeeId: employee.id,
        clockIn: new Date(),
        status: 'OPEN',
        workOrderId,
        department: employee.department,
      },
    });
  }

  return { employeeId: employee.id };
}

async function seedDemoMes(
  client: PrismaClient,
  workOrderId: string,
  employeeId: string,
): Promise<void> {
  const ws = await client.workstation.findUniqueOrThrow({
    where: { code: 'WS-LASER' },
  });

  const openOp = await client.workOrderOperation.findFirst({
    where: { workOrderId, status: 'IN_PROGRESS' },
  });
  if (openOp) return;

  const op = await client.workOrderOperation.create({
    data: {
      workOrderId,
      workstationId: ws.id,
      sequence: 1,
      name: 'Demo Laser Cut',
      status: 'IN_PROGRESS',
      standardMinutes: 20,
    },
  });

  await client.cycleRecord.create({
    data: {
      operationId: op.id,
      employeeId,
      startedAt: new Date(),
      endedAt: null,
      quantityCompleted: 0,
      quantityScrapped: 0,
    },
  });
}

async function seedDemoQms(
  client: PrismaClient,
  workOrderId: string,
  binDemoId: string,
): Promise<void> {
  const inspector = await client.user.findUniqueOrThrow({
    where: { email: 'inspector@arcncode.local' },
  });

  const template = await client.inspectionTemplate.upsert({
    where: { code: DEMO.TMPL_DEMO },
    update: {},
    create: {
      code: DEMO.TMPL_DEMO,
      name: 'Demo Incoming Inspection',
      description: 'Tutorial inspection template',
      active: true,
      criteria: {
        create: [
          { sequence: 1, label: 'Surface finish', type: 'PASS_FAIL' },
          {
            sequence: 2,
            label: 'Width check',
            type: 'MEASUREMENT',
            expectedMin: 9,
            expectedMax: 11,
            unit: 'mm',
          },
        ],
      },
    },
  });

  const ncExists = await client.nonConformanceRecord.findFirst({
    where: { ncNumber: 'NC-DEMO-001' },
  });
  if (!ncExists) {
    await client.workOrder.update({
      where: { id: workOrderId },
      data: { onHold: true },
    });
    await client.bin.update({
      where: { id: binDemoId },
      data: { onHold: true },
    });
    await client.nonConformanceRecord.create({
      data: {
        ncNumber: 'NC-DEMO-001',
        workOrderId,
        binId: binDemoId,
        severity: 'HOLD',
        holdActive: true,
        status: 'OPEN',
        description: 'Demo hold for disposition tutorial',
        source: 'INSPECTION',
        raisedByUserId: inspector.id,
      },
    });
  }
}

async function seedDemoCmms(client: PrismaClient): Promise<void> {
  if (await client.maintenanceWorkOrder.findUnique({ where: { mwoNumber: DEMO.MWO } })) {
    return;
  }

  const ws = await client.workstation.findUniqueOrThrow({
    where: { code: 'WS-LASER' },
  });

  const asset = await client.asset.upsert({
    where: { code: DEMO.ASSET_DEMO },
    update: {},
    create: {
      code: DEMO.ASSET_DEMO,
      name: 'Demo Laser Asset',
      workstationId: ws.id,
      status: 'OPERATIONAL',
    },
  });

  await client.maintenanceWorkOrder.create({
    data: {
      mwoNumber: DEMO.MWO,
      assetId: asset.id,
      type: 'CORRECTIVE',
      status: 'OPEN',
      description: 'Demo corrective maintenance for tutorial',
      scheduledDate: daysFromNow(1),
    },
  });
}

async function seedDemoReturns(
  client: PrismaClient,
  shippedLineId: string,
  shippedOrderId: string,
  customerId: string,
  returnsBinId: string,
): Promise<void> {
  if (await client.rma.findUnique({ where: { rmaNumber: DEMO.RMA_REQUESTED } })) {
    return;
  }

  const support = await client.user.findUniqueOrThrow({
    where: { email: 'support@arcncode.local' },
  });
  const manager = await client.user.findUniqueOrThrow({
    where: { email: 'manager@arcncode.local' },
  });

  await client.rma.create({
    data: {
      rmaNumber: DEMO.RMA_REQUESTED,
      salesOrderId: shippedOrderId,
      salesOrderLineId: shippedLineId,
      customerId,
      reasonCode: 'DEFECTIVE',
      status: 'REQUESTED',
      quantity: 1,
      qualityRelated: true,
      requestedByUserId: support.id,
    },
  });

  await client.rma.create({
    data: {
      rmaNumber: DEMO.RMA_APPROVED,
      salesOrderId: shippedOrderId,
      salesOrderLineId: shippedLineId,
      customerId,
      reasonCode: 'WRONG_ITEM',
      status: 'APPROVED',
      quantity: 1,
      requestedByUserId: support.id,
      approvedByUserId: manager.id,
      approvedAt: daysAgo(1),
    },
  });

  await client.rma.create({
    data: {
      rmaNumber: DEMO.RMA_RECEIVED,
      salesOrderId: shippedOrderId,
      salesOrderLineId: shippedLineId,
      customerId,
      reasonCode: 'DAMAGED_IN_TRANSIT',
      status: 'RECEIVED',
      quantity: 1,
      returnedBinId: returnsBinId,
      requestedByUserId: support.id,
      approvedByUserId: manager.id,
      approvedAt: daysAgo(3),
      receivedByUserId: support.id,
      receivedAt: daysAgo(2),
    },
  });

  const cm = await client.creditMemo.create({
    data: {
      creditMemoNumber: DEMO.CM_DEMO,
      customerId,
      status: 'POSTED',
      issueDate: daysAgo(5),
      total: 249.99,
      lines: {
        create: [
          {
            description: 'Demo refund credit',
            quantity: 1,
            unitPrice: 249.99,
            amount: 249.99,
          },
        ],
      },
    },
  });

  await client.rma.create({
    data: {
      rmaNumber: DEMO.RMA_RESOLVED,
      salesOrderId: shippedOrderId,
      salesOrderLineId: shippedLineId,
      customerId,
      reasonCode: 'OTHER',
      status: 'RESOLVED',
      resolutionType: 'REFUND',
      quantity: 1,
      returnedBinId: returnsBinId,
      creditMemoId: cm.id,
      requestedByUserId: support.id,
      approvedByUserId: manager.id,
      approvedAt: daysAgo(6),
      receivedByUserId: support.id,
      receivedAt: daysAgo(5),
      resolvedByUserId: support.id,
      resolvedAt: daysAgo(4),
    },
  });
}

async function seedDemoAnalytics(
  client: PrismaClient,
  skuMakeId: string,
): Promise<void> {
  const guard = await client.analyticsEvent.findUnique({
    where: { dedupeKey: 'DEMO-SEED-ANALYTICS-GUARD' },
  });
  if (guard) return;

  const topics = [
    'sales.order.shipped',
    'mes.cycle.recorded',
    'qms.scrap.reported',
    'procurement.po.received',
    'returns.rma.resolved',
    'finance.invoice.posted',
  ];

  for (let day = 0; day < 30; day++) {
    const occurredAt = daysAgo(day);
    for (const topic of topics) {
      await client.analyticsEvent.create({
        data: {
          topic,
          module: topic.split('.')[0] ?? 'demo',
          entityId: `demo-${topic}-${day}`,
          dedupeKey: `demo-${topic}-${day}`,
          payload: { demo: true, day },
          occurredAt,
        },
      });
    }
  }

  await client.analyticsEvent.create({
    data: {
      topic: 'demo.seed.complete',
      module: 'demo',
      entityId: 'phase-18',
      dedupeKey: 'DEMO-SEED-ANALYTICS-GUARD',
      payload: { phase: 18 },
      occurredAt: new Date(),
    },
  });

  const asOf = utcMidnight();
  await client.inventoryForecast.upsert({
    where: { productId_asOfDate: { productId: skuMakeId, asOfDate: asOf } },
    create: {
      productId: skuMakeId,
      asOfDate: asOf,
      avgDailyDemand: 3.2,
      onHand: 40,
      projectedDepletionDate: daysFromNow(12),
      recommendedReorderDate: daysFromNow(7),
      leadTimeDays: 14,
    },
    update: {},
  });
}

export async function seedDemoScenarios(client: PrismaClient): Promise<void> {
  if (await isDemoSeeded()) {
    console.log('Demo scenarios already applied — skipping');
    return;
  }

  console.log('Seeding Phase 18 demo scenarios…');

  const erp = await seedDemoErp(client);
  const wms = await seedDemoWms(client, erp);
  await seedDemoPlm(client, erp.skuMakeId);
  const cpq = await seedDemoCpq(client, erp.customerGlobexId, erp.skuFinishedId);
  const sales = await seedDemoSales(client, {
    customerGlobexId: erp.customerGlobexId,
    skuFinishedId: erp.skuFinishedId,
    skuMakeId: erp.skuMakeId,
    quoteAcceptedId: cpq.quoteAcceptedId,
    binDemoId: wms.binDemoId,
  });

  const shippedOrder = await client.salesOrder.findUniqueOrThrow({
    where: { orderNumber: DEMO.SO_SHIPPED },
  });

  await seedDemoFinance(client, erp.vendorPartsId);
  const mps = await seedDemoMpsMrp(
    client,
    erp.skuMakeId,
    erp.skuBuyId,
    erp.vendorPartsId,
  );
  await seedDemoProcurement(client, erp.skuBuyId, erp.vendorPartsId);
  const workforce = await seedDemoWorkforce(client, mps.workOrderId);
  await seedDemoMes(client, mps.workOrderId, workforce.employeeId);
  await seedDemoQms(client, mps.workOrderId, wms.binDemoId);
  await seedDemoCmms(client);

  const returnsBin = await client.bin.findUniqueOrThrow({ where: { code: 'RET-01' } });
  await seedDemoReturns(
    client,
    sales.shippedLineId,
    shippedOrder.id,
    shippedOrder.customerId,
    returnsBin.id,
  );
  await seedDemoAnalytics(client, erp.skuMakeId);

  console.log('Demo scenarios seeded successfully');
}

export async function seedDemo(): Promise<void> {
  await seedMain();
  await seedDemoScenarios(prisma);
}

const isDirectRun =
  typeof require !== 'undefined' &&
  require.main === module;

if (isDirectRun) {
  seedDemo()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
