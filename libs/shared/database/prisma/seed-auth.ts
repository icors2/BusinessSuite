import { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type SeedAuthResult = {
  adminUser: User;
  roleNames: string[];
};

export async function seedAuth(
  client: PrismaClient = new PrismaClient(),
): Promise<SeedAuthResult> {
  const adminRole = await client.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });

  const managerRole = await client.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: { name: 'Manager' },
  });

  const viewerRole = await client.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: { name: 'Viewer' },
  });

  const operatorRole = await client.role.upsert({
    where: { name: 'Operator' },
    update: {},
    create: { name: 'Operator' },
  });

  const supervisorRole = await client.role.upsert({
    where: { name: 'Supervisor' },
    update: {},
    create: { name: 'Supervisor' },
  });

  const inspectorRole = await client.role.upsert({
    where: { name: 'Inspector' },
    update: {},
    create: { name: 'Inspector' },
  });

  const technicianRole = await client.role.upsert({
    where: { name: 'Technician' },
    update: {},
    create: { name: 'Technician' },
  });

  const supportRole = await client.role.upsert({
    where: { name: 'Support' },
    update: {},
    create: { name: 'Support' },
  });

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminUser = await client.user.upsert({
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

  await client.user.upsert({
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

  await client.user.upsert({
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

  await client.user.upsert({
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

  await client.user.upsert({
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

  await client.user.upsert({
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

  await client.user.upsert({
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

  await client.user.upsert({
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

  return {
    adminUser,
    roleNames: [
      adminRole.name,
      managerRole.name,
      viewerRole.name,
      operatorRole.name,
      supervisorRole.name,
      inspectorRole.name,
      technicianRole.name,
      supportRole.name,
    ],
  };
}

const prisma = new PrismaClient();

const isDirectRun =
  typeof require !== 'undefined' && require.main === module;

if (isDirectRun) {
  seedAuth(prisma)
    .then(({ adminUser, roleNames }) => {
      console.log('Auth seed complete:', {
        adminUserId: adminUser.id,
        roles: roleNames,
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
