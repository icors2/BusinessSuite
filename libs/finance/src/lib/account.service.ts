import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { CreateAccountInput, UpdateAccountInput } from './schemas';
import { toNumber } from './utils';

function mapAccount(account: {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...account };
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateAccountInput, actorId?: string) {
    const code = input.code.trim();
    await this.assertCodeUnique(code);

    const account = await this.prisma.account.create({
      data: {
        code,
        name: input.name.trim(),
        type: input.type,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Account',
      entityId: account.id,
      metadata: { code: account.code },
    });

    return mapAccount(account);
  }

  async getById(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return mapAccount(account);
  }

  async getByCode(code: string) {
    const account = await this.prisma.account.findUnique({
      where: { code },
    });
    if (!account) {
      throw new NotFoundException(`Account with code ${code} not found`);
    }
    return account;
  }

  async list(options: {
    type?: string;
    includeInactive?: boolean;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.AccountWhereInput = {
      ...(options.includeInactive ? {} : { active: true }),
      ...(options.type ? { type: options.type as Prisma.EnumAccountTypeFilter['equals'] } : {}),
    };

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.account.count({ where }),
    ]);

    return { items: items.map(mapAccount), total };
  }

  async update(id: string, input: UpdateAccountInput, actorId?: string) {
    await this.getById(id);

    if (input.code !== undefined) {
      const code = input.code.trim();
      await this.assertCodeUnique(code, id);
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'update',
      entityType: 'Account',
      entityId: account.id,
      metadata: { code: account.code },
    });

    return mapAccount(account);
  }

  async deactivate(id: string, actorId?: string) {
    const existing = await this.getById(id);
    if (!existing.active) {
      return existing;
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.record({
      actorId,
      action: 'deactivate',
      entityType: 'Account',
      entityId: account.id,
      metadata: { code: account.code },
    });

    return mapAccount(account);
  }

  async assertCodeUnique(code: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.account.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(`Account code "${code}" already exists`);
    }
  }

  /** Exposed for report tests — balance from posted lines. */
  async getPostedBalance(accountId: string, asOf?: Date): Promise<number> {
    const account = await this.getById(accountId);
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          status: 'POSTED',
          ...(asOf ? { date: { lte: asOf } } : {}),
        },
      },
    });

    const debits = lines.reduce((s, l) => s + toNumber(l.debit), 0);
    const credits = lines.reduce((s, l) => s + toNumber(l.credit), 0);

    switch (account.type) {
      case 'ASSET':
      case 'EXPENSE':
        return Math.round((debits - credits) * 100) / 100;
      default:
        return Math.round((credits - debits) * 100) / 100;
    }
  }
}
