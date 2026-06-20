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
import { DEFAULT_ACCOUNTS, FINANCE_EVENTS } from './events';
import { JournalService } from './journal.service';
import { CreateBillInput } from './schemas';
import { lineAmount, roundMoney, toNumber } from './utils';

function mapBill(bill: {
  id: string;
  billNumber: string;
  vendorId: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  total: { toNumber(): number } | number;
  amountPaid: { toNumber(): number } | number;
  journalEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  vendor?: { id: string; name: string };
  lines?: {
    id: string;
    description: string;
    quantity: { toNumber(): number } | number;
    unitPrice: { toNumber(): number } | number;
    amount: { toNumber(): number } | number;
    expenseAccountId: string;
    expenseAccount?: { code: string; name: string };
  }[];
}) {
  const total = toNumber(bill.total);
  const amountPaid = toNumber(bill.amountPaid);
  return {
    ...bill,
    total,
    amountPaid,
    amountDue: roundMoney(total - amountPaid),
    lines: bill.lines?.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
      amount: toNumber(line.amount),
      expenseAccountId: line.expenseAccountId,
      expenseAccount: line.expenseAccount,
    })),
  };
}

@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accountService: AccountService,
    private readonly journalService: JournalService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateBillInput, actorId?: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: input.vendorId, deletedAt: null, active: true },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor ${input.vendorId} not found`);
    }

    for (const line of input.lines) {
      await this.accountService.getById(line.expenseAccountId);
    }

    const lines = input.lines.map((line) => {
      const amount = lineAmount(line.quantity, line.unitPrice);
      return {
        description: line.description.trim(),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount,
        expenseAccountId: line.expenseAccountId,
      };
    });
    const total = roundMoney(lines.reduce((s, l) => s + l.amount, 0));

    const billNumber =
      input.billNumber?.trim() ||
      `BILL-${Date.now().toString(36).toUpperCase()}`;

    const bill = await this.prisma.bill.create({
      data: {
        billNumber,
        vendorId: input.vendorId,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        status: 'DRAFT',
        total,
        lines: { create: lines },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { expenseAccount: true } },
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Bill',
      entityId: bill.id,
      metadata: { billNumber: bill.billNumber, total },
    });

    await this.eventBus.publish(FINANCE_EVENTS.bill.created, {
      entityId: bill.id,
      actorId,
      payload: {
        billNumber: bill.billNumber,
        vendorId: bill.vendorId,
        total,
      },
    });

    return mapBill(bill);
  }

  async getById(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { expenseAccount: true } },
      },
    });
    if (!bill) {
      throw new NotFoundException(`Bill ${id} not found`);
    }
    return mapBill(bill);
  }

  async list(options: {
    vendorId?: string;
    status?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const where = {
      ...(options.vendorId ? { vendorId: options.vendorId } : {}),
      ...(options.status
        ? { status: options.status as 'DRAFT' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED' }
        : {}),
      ...(options.search?.trim()
        ? {
            OR: [
              {
                billNumber: {
                  contains: options.search.trim(),
                  mode: 'insensitive' as const,
                },
              },
              {
                vendor: {
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
      this.prisma.bill.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true } },
          lines: { include: { expenseAccount: true } },
        },
        orderBy: { issueDate: 'desc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.bill.count({ where }),
    ]);

    return {
      items: items.map(mapBill),
      total,
    };
  }

  async post(id: string, actorId?: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!bill) {
      throw new NotFoundException(`Bill ${id} not found`);
    }
    if (bill.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT bills can be posted (current: ${bill.status})`,
      );
    }

    const apAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.ACCOUNTS_PAYABLE,
    );
    const amount = toNumber(bill.total);

    const debitLines = bill.lines.map((line) => ({
      accountId: line.expenseAccountId,
      debit: toNumber(line.amount),
      credit: 0,
      description: line.description,
    }));

    const journalEntry = await this.journalService.createAndPost(
      {
        date: bill.issueDate,
        memo: `Bill ${bill.billNumber}`,
        lines: [
          ...debitLines,
          {
            accountId: apAccount.id,
            debit: 0,
            credit: amount,
            description: `AP — ${bill.billNumber}`,
          },
        ],
      },
      actorId,
    );

    const updated = await this.prisma.bill.update({
      where: { id },
      data: {
        status: 'OPEN',
        journalEntryId: journalEntry.id,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { expenseAccount: true } },
      },
    });

    await this.audit.record({
      actorId,
      action: 'post',
      entityType: 'Bill',
      entityId: updated.id,
      metadata: { billNumber: updated.billNumber },
    });

    await this.eventBus.publish(FINANCE_EVENTS.bill.posted, {
      entityId: updated.id,
      actorId,
      payload: {
        billNumber: updated.billNumber,
        total: amount,
      },
    });

    return mapBill(updated);
  }

  async voidBill(id: string, actorId?: string) {
    const bill = await this.getById(id);
    if (bill.status === 'VOIDED') {
      return bill;
    }
    if (bill.status === 'DRAFT') {
      const updated = await this.prisma.bill.update({
        where: { id },
        data: { status: 'VOIDED' },
        include: {
          vendor: { select: { id: true, name: true } },
          lines: { include: { expenseAccount: true } },
        },
      });
      return mapBill(updated);
    }
    if (bill.journalEntryId) {
      await this.journalService.reverse(bill.journalEntryId, actorId);
    }

    const updated = await this.prisma.bill.update({
      where: { id },
      data: { status: 'VOIDED' },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { expenseAccount: true } },
      },
    });

    await this.eventBus.publish(FINANCE_EVENTS.bill.voided, {
      entityId: updated.id,
      actorId,
      payload: { billNumber: updated.billNumber },
    });

    return mapBill(updated);
  }
}
