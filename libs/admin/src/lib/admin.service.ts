import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { WorkforceService } from 'workforce';
import {
  CreateUserInput,
  DeactivateUserInput,
  ListUsersInput,
  ResetPasswordInput,
  UpdateUserRolesInput,
} from './schemas';
import {
  CreateEmployeeInput,
  ListEmployeesInput,
  UpdateEmployeeInput,
} from 'workforce';

const userInclude = {
  roles: { include: { role: true } },
  employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly workforce: WorkforceService,
  ) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => ({ id: role.id, name: role.name }));
  }

  async listUsers(input: ListUsersInput = {}) {
    const where: Prisma.UserWhereInput = {};
    if (input.search?.trim()) {
      where.email = { contains: input.search.trim().toLowerCase(), mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { email: 'asc' },
        skip: input.skip,
        take: input.take ?? 50,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => this.mapUser(user)),
      total,
    };
  }

  async createUser(input: CreateUserInput, actorId?: string) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: input.roleNames } },
    });
    if (roles.length !== input.roleNames.length) {
      throw new ConflictException('One or more roles are invalid');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        roles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
      },
      include: userInclude,
    });

    await this.audit.record({
      actorId,
      action: 'admin.user.created',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, roles: input.roleNames },
    });

    return this.mapUser(user);
  }

  async updateUserRoles(input: UpdateUserRolesInput, actorId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: { roles: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: input.roleNames } },
    });
    if (roles.length !== input.roleNames.length) {
      throw new ConflictException('One or more roles are invalid');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: input.userId } }),
      this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId: input.userId, roleId: role.id })),
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: input.userId } }),
    ]);

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: userInclude,
    });

    await this.audit.record({
      actorId,
      action: 'admin.user.roles_updated',
      entityType: 'User',
      entityId: input.userId,
      metadata: { roles: input.roleNames },
    });

    return this.mapUser(updated);
  }

  async deactivateUser(input: DeactivateUserInput, actorId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.email.startsWith('deactivated+')) {
      throw new BadRequestException('User is already deactivated');
    }

    const lockHash = await bcrypt.hash(crypto.randomUUID(), 12);
    const archivedEmail = `deactivated+${user.id}@${user.email.replace('@', '.')}`;

    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId: input.userId } }),
      this.prisma.user.update({
        where: { id: input.userId },
        data: {
          email: archivedEmail,
          passwordHash: lockHash,
        },
      }),
    ]);

    await this.audit.record({
      actorId,
      action: 'admin.user.deactivated',
      entityType: 'User',
      entityId: input.userId,
      metadata: { previousEmail: user.email },
    });

    return { success: true };
  }

  async resetPassword(input: ResetPasswordInput, actorId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.email.startsWith('deactivated+')) {
      throw new BadRequestException('Cannot reset password for deactivated user');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: input.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: input.userId } }),
    ]);

    await this.audit.record({
      actorId,
      action: 'admin.user.password_reset',
      entityType: 'User',
      entityId: input.userId,
    });

    return { success: true };
  }

  listEmployees(input: ListEmployeesInput = {}) {
    return this.workforce.listEmployees(input);
  }

  createEmployee(input: CreateEmployeeInput, actorId?: string) {
    return this.workforce.createEmployee(input, actorId);
  }

  updateEmployee(input: UpdateEmployeeInput, actorId?: string) {
    return this.workforce.updateEmployee(input, actorId);
  }

  private mapUser(
    user: Prisma.UserGetPayload<{ include: typeof userInclude }>,
  ) {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((entry) => entry.role.name),
      createdAt: user.createdAt,
      employee: user.employee,
      deactivated: user.email.startsWith('deactivated+'),
    };
  }
}
