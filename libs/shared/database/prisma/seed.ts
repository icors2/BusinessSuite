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

  console.log('Seed complete:', {
    adminUserId: adminUser.id,
    roles: [adminRole.name, managerRole.name],
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
