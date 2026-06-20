import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { AccountService } from './account.service';
import {
  formatCreditMemoNumber,
  parseCreditMemoSequence,
} from './credit-memo-number';
import { DEFAULT_ACCOUNTS, FINANCE_EVENTS } from './events';
import { JournalService } from './journal.service';
import { CreateCreditMemoInput } from './schemas';
import { lineAmount, roundMoney, toNumber } from './utils';

function mapCreditMemo(creditMemo: {
  id: string;
  creditMemoNumber: string;
  customerId: string;
  invoiceId: string | null;
  status: string;
  issueDate: Date;
  total: { toNumber(): number } | number;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: { id: string; name: string };
  lines?: {
    id: string;
    description: string;
    quantity: { toNumber(): number } | number;
    unitPrice: { toNumber(): number } | number;
    amount: { toNumber(): number } | number;
  }[];
}) {
  return {
    ...creditMemo,
    total: toNumber(creditMemo.total),
    lines: creditMemo.lines?.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
      amount: toNumber(line.amount),
    })),
  };
}

@Injectable()
export class CreditMemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accountService: AccountService,
    private readonly journalService: JournalService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateCreditMemoInput, actorId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, deletedAt: null, active: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${input.customerId} not found`);
    }

    const lines = input.lines.map((line) => {
      const amount = lineAmount(line.quantity, line.unitPrice);
      return {
        description: line.description.trim(),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount,
      };
    });
    const total = roundMoney(lines.reduce((s, l) => s + l.amount, 0));

    const creditMemoNumber =
      input.creditMemoNumber?.trim() || (await this.nextCreditMemoNumber());

    const creditMemo = await this.prisma.creditMemo.create({
      data: {
        creditMemoNumber,
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        issueDate: input.issueDate,
        status: 'DRAFT',
        total,
        notes: input.notes,
        lines: { create: lines },
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: true,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'CreditMemo',
      entityId: creditMemo.id,
      metadata: { creditMemoNumber, total },
    });

    await this.eventBus.publish(FINANCE_EVENTS.creditmemo.created, {
      entityId: creditMemo.id,
      actorId,
      payload: {
        creditMemoNumber: creditMemo.creditMemoNumber,
        customerId: creditMemo.customerId,
        total,
      },
    });

    return mapCreditMemo(creditMemo);
  }

  async getById(id: string) {
    const creditMemo = await this.prisma.creditMemo.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        lines: true,
      },
    });
    if (!creditMemo) {
      throw new NotFoundException(`Credit memo ${id} not found`);
    }
    return mapCreditMemo(creditMemo);
  }

  async list(options: {
    customerId?: string;
    status?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const where = {
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(options.status
        ? {
            status: options.status as 'DRAFT' | 'POSTED' | 'VOIDED',
          }
        : {}),
      ...(options.search?.trim()
        ? {
            OR: [
              {
                creditMemoNumber: {
                  contains: options.search.trim(),
                  mode: 'insensitive' as const,
                },
              },
              {
                customer: {
                  name: {
                    contains: options.search.trim(),
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.creditMemo.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          lines: true,
        },
        orderBy: { issueDate: 'desc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.creditMemo.count({ where }),
    ]);

    return {
      items: items.map(mapCreditMemo),
      total,
    };
  }

  async post(id: string, actorId?: string) {
    const creditMemo = await this.prisma.creditMemo.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!creditMemo) {
      throw new NotFoundException(`Credit memo ${id} not found`);
    }
    if (creditMemo.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT credit memos can be posted (current: ${creditMemo.status})`,
      );
    }

    const arAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.ACCOUNTS_RECEIVABLE,
    );
    const revenueAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.SALES_REVENUE,
    );
    const amount = toNumber(creditMemo.total);

    const journalEntry = await this.journalService.createAndPost(
      {
        date: creditMemo.issueDate,
        memo: `Credit memo ${creditMemo.creditMemoNumber}`,
        lines: [
          {
            accountId: revenueAccount.id,
            debit: amount,
            credit: 0,
            description: `Sales return — ${creditMemo.creditMemoNumber}`,
          },
          {
            accountId: arAccount.id,
            debit: 0,
            credit: amount,
            description: `AR credit — ${creditMemo.creditMemoNumber}`,
          },
        ],
      },
      actorId,
    );

    const updated = await this.prisma.creditMemo.update({
      where: { id },
      data: {
        status: 'POSTED',
        journalEntryId: journalEntry.id,
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: true,
      },
    });

    await this.audit.record({
      actorId,
      action: 'post',
      entityType: 'CreditMemo',
      entityId: updated.id,
      metadata: { creditMemoNumber: updated.creditMemoNumber },
    });

    await this.eventBus.publish(FINANCE_EVENTS.creditmemo.posted, {
      entityId: updated.id,
      actorId,
      payload: {
        creditMemoNumber: updated.creditMemoNumber,
        total: amount,
      },
    });

    return mapCreditMemo(updated);
  }

  async voidCreditMemo(id: string, actorId?: string) {
    const creditMemo = await this.getById(id);
    if (creditMemo.status === 'VOIDED') {
      return creditMemo;
    }
    if (creditMemo.status === 'DRAFT') {
      const updated = await this.prisma.creditMemo.update({
        where: { id },
        data: { status: 'VOIDED' },
        include: {
          customer: { select: { id: true, name: true } },
          lines: true,
        },
      });
      return mapCreditMemo(updated);
    }
    if (creditMemo.journalEntryId) {
      await this.journalService.reverse(creditMemo.journalEntryId, actorId);
    }

    const updated = await this.prisma.creditMemo.update({
      where: { id },
      data: { status: 'VOIDED' },
      include: {
        customer: { select: { id: true, name: true } },
        lines: true,
      },
    });

    return mapCreditMemo(updated);
  }

  private async nextCreditMemoNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `CM-${year}-`;
    const latest = await this.prisma.creditMemo.findFirst({
      where: { creditMemoNumber: { startsWith: prefix } },
      orderBy: { creditMemoNumber: 'desc' },
      select: { creditMemoNumber: true },
    });

    let maxSeq = 0;
    if (latest) {
      const parsed = parseCreditMemoSequence(latest.creditMemoNumber, year);
      if (parsed != null) maxSeq = parsed;
    }

    return formatCreditMemoNumber(year, maxSeq + 1);
  }
}
