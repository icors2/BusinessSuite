import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  const existingCustomer = await prisma.customer.findFirst({
    where: { name: 'Acme Manufacturing', deletedAt: null },
  });

  if (!existingCustomer) {
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

  const existingVendor = await prisma.vendor.findFirst({
    where: { name: 'Global Supplies Co', deletedAt: null },
  });

  if (!existingVendor) {
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

  console.log('Seed complete:', {
    adminUserId: adminUser.id,
    roles: [adminRole.name, managerRole.name, viewerRole.name],
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
