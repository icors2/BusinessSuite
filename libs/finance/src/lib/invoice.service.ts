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
import { CreateInvoiceInput } from './schemas';
import { lineAmount, roundMoney, toNumber } from './utils';

function mapInvoice(invoice: {
  id: string;
  invoiceNumber: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  total: { toNumber(): number } | number;
  amountPaid: { toNumber(): number } | number;
  journalEntryId: string | null;
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
  const total = toNumber(invoice.total);
  const amountPaid = toNumber(invoice.amountPaid);
  return {
    ...invoice,
    total,
    amountPaid,
    amountDue: roundMoney(total - amountPaid),
    lines: invoice.lines?.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
      amount: toNumber(line.amount),
    })),
  };
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accountService: AccountService,
    private readonly journalService: JournalService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateInvoiceInput, actorId?: string) {
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

    const invoiceNumber =
      input.invoiceNumber?.trim() ||
      `INV-${Date.now().toString(36).toUpperCase()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: input.customerId,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        status: 'DRAFT',
        total,
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
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, total },
    });

    await this.eventBus.publish(FINANCE_EVENTS.invoice.created, {
      entityId: invoice.id,
      actorId,
      payload: {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        total,
      },
    });

    return mapInvoice(invoice);
  }

  async getById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        lines: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return mapInvoice(invoice);
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
        ? { status: options.status as 'DRAFT' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED' }
        : {}),
      ...(options.search?.trim()
        ? {
            OR: [
              {
                invoiceNumber: {
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
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          lines: true,
        },
        orderBy: { issueDate: 'desc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map(mapInvoice),
      total,
    };
  }

  async post(id: string, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT invoices can be posted (current: ${invoice.status})`,
      );
    }

    const arAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.ACCOUNTS_RECEIVABLE,
    );
    const revenueAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.SALES_REVENUE,
    );
    const amount = toNumber(invoice.total);

    const journalEntry = await this.journalService.createAndPost(
      {
        date: invoice.issueDate,
        memo: `Invoice ${invoice.invoiceNumber}`,
        lines: [
          {
            accountId: arAccount.id,
            debit: amount,
            credit: 0,
            description: `AR — ${invoice.invoiceNumber}`,
          },
          {
            accountId: revenueAccount.id,
            debit: 0,
            credit: amount,
            description: `Revenue — ${invoice.invoiceNumber}`,
          },
        ],
      },
      actorId,
    );

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'OPEN',
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
      entityType: 'Invoice',
      entityId: updated.id,
      metadata: { invoiceNumber: updated.invoiceNumber },
    });

    await this.eventBus.publish(FINANCE_EVENTS.invoice.posted, {
      entityId: updated.id,
      actorId,
      payload: {
        invoiceNumber: updated.invoiceNumber,
        total: amount,
      },
    });

    return mapInvoice(updated);
  }

  async voidInvoice(id: string, actorId?: string) {
    const invoice = await this.getById(id);
    if (invoice.status === 'VOIDED') {
      return invoice;
    }
    if (invoice.status === 'DRAFT') {
      const updated = await this.prisma.invoice.update({
        where: { id },
        data: { status: 'VOIDED' },
        include: {
          customer: { select: { id: true, name: true } },
          lines: true,
        },
      });
      return mapInvoice(updated);
    }
    if (invoice.journalEntryId) {
      await this.journalService.reverse(invoice.journalEntryId, actorId);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'VOIDED' },
      include: {
        customer: { select: { id: true, name: true } },
        lines: true,
      },
    });

    await this.eventBus.publish(FINANCE_EVENTS.invoice.voided, {
      entityId: updated.id,
      actorId,
      payload: { invoiceNumber: updated.invoiceNumber },
    });

    return mapInvoice(updated);
  }
}
