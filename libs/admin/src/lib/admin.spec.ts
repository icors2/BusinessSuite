import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const workforce = {
    listEmployees: jest.fn(),
    createEmployee: jest.fn(),
    updateEmployee: jest.fn(),
  };

  function createService(prisma: Record<string, unknown>) {
    return new AdminService(
      prisma as never,
      audit as never,
      workforce as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user with valid roles', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'new@example.com',
          createdAt: new Date(),
          roles: [{ role: { name: 'Manager' } }],
          employee: null,
        }),
      },
      role: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'role-1', name: 'Manager' }]),
      },
    };

    const service = createService(prisma);
    const result = await service.createUser(
      {
        email: 'new@example.com',
        password: 'Password123!',
        roleNames: ['Manager'],
      },
      'admin-1',
    );

    expect(result.email).toBe('new@example.com');
    expect(result.roles).toEqual(['Manager']);
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects duplicate email on create', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing' }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.createUser({
        email: 'dup@example.com',
        password: 'Password123!',
        roleNames: ['Manager'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates user roles', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'user-1', roles: [] })
          .mockResolvedValueOnce({
            id: 'user-1',
            email: 'user@example.com',
            createdAt: new Date(),
            roles: [{ role: { name: 'Admin' } }],
            employee: null,
          }),
        findUniqueOrThrow: jest.fn(),
      },
      role: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'role-admin', name: 'Admin' }]),
      },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    prisma.user.findUniqueOrThrow = prisma.user.findUnique;

    const service = createService(prisma);
    const result = await service.updateUserRoles(
      { userId: 'user-1', roleNames: ['Admin'] },
      'admin-1',
    );

    expect(result.roles).toEqual(['Admin']);
  });

  it('throws when resetting password for missing user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = createService(prisma);

    await expect(
      service.resetPassword({
        userId: 'missing',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates employee listing to workforce service', async () => {
    workforce.listEmployees.mockResolvedValue({ items: [], total: 0 });
    const service = createService({});

    await service.listEmployees({ take: 10 });

    expect(workforce.listEmployees).toHaveBeenCalledWith({ take: 10 });
  });
});
