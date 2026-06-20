import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { FINANCE_EVENTS } from './events';
import { CreateJournalEntryInput } from './schemas';
import {
  nextEntryNumber,
  roundMoney,
  sumCredits,
  sumDebits,
  toNumber,
} from './utils';

function mapJournalEntry(entry: {
  id: string;
  entryNumber: string;
  date: Date;
  memo: string | null;
  status: string;
  postedAt: Date | null;
  reversalOfId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    accountId: string;
    debit: { toNumber(): number } | number;
    credit: { toNumber(): number } | number;
    description: string | null;
    account?: { code: string; name: string; type: string };
  }[];
}) {
  return {
    ...entry,
    lines: entry.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      description: line.description,
      account: line.account,
    })),
  };
}

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateJournalEntryInput, actorId?: string) {
    this.validateLines(input.lines);

    const entryNumber = await nextEntryNumber(this.prisma);
    const entry = await this.prisma.journalEntry.create({
      data: {
        entryNumber,
        date: input.date,
        memo: input.memo?.trim() || null,
        status: 'DRAFT',
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description?.trim() || null,
          })),
        },
      },
      include: {
        lines: { include: { account: true } },
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'JournalEntry',
      entityId: entry.id,
      metadata: { entryNumber: entry.entryNumber },
    });

    return mapJournalEntry(entry);
  }

  async getById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { account: true } },
      },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    return mapJournalEntry(entry);
  }

  async list(options: {
    status?: string;
    from?: Date;
    to?: Date;
    skip?: number;
    take?: number;
  }) {
    const where = {
      ...(options.status
        ? { status: options.status as 'DRAFT' | 'POSTED' | 'REVERSED' }
        : {}),
      ...(options.from || options.to
        ? {
            date: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: { lines: { include: { account: true } } },
        orderBy: { date: 'desc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      items: items.map(mapJournalEntry),
      total,
    };
  }

  async post(id: string, actorId?: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (entry.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT entries can be posted (current: ${entry.status})`,
      );
    }

    this.assertBalanced(entry.lines);

    const posted = await this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date() },
      include: { lines: { include: { account: true } } },
    });

    await this.audit.record({
      actorId,
      action: 'post',
      entityType: 'JournalEntry',
      entityId: posted.id,
      metadata: { entryNumber: posted.entryNumber },
    });

    await this.eventBus.publish(FINANCE_EVENTS.journal.posted, {
      entityId: posted.id,
      actorId,
      payload: {
        entryNumber: posted.entryNumber,
        total: sumDebits(posted.lines),
      },
    });

    return mapJournalEntry(posted);
  }

  async reverse(id: string, actorId?: string) {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!original) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (original.status !== 'POSTED') {
      throw new BadRequestException(
        `Only POSTED entries can be reversed (current: ${original.status})`,
      );
    }

    const entryNumber = await nextEntryNumber(this.prisma);
    const reversal = await this.prisma.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(),
        memo: `Reversal of ${original.entryNumber}`,
        status: 'POSTED',
        postedAt: new Date(),
        reversalOfId: original.id,
        lines: {
          create: original.lines.map((line) => ({
            accountId: line.accountId,
            debit: toNumber(line.credit),
            credit: toNumber(line.debit),
            description: `Reversal: ${line.description ?? ''}`.trim(),
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    await this.prisma.journalEntry.update({
      where: { id: original.id },
      data: { status: 'REVERSED' },
    });

    await this.audit.record({
      actorId,
      action: 'reverse',
      entityType: 'JournalEntry',
      entityId: reversal.id,
      metadata: {
        entryNumber: reversal.entryNumber,
        reversedEntryId: original.id,
      },
    });

    await this.eventBus.publish(FINANCE_EVENTS.journal.reversed, {
      entityId: reversal.id,
      actorId,
      payload: {
        entryNumber: reversal.entryNumber,
        reversedEntryId: original.id,
      },
    });

    return mapJournalEntry(reversal);
  }

  /** Create and immediately post a balanced entry (used by invoice/bill/payment). */
  async createAndPost(
    input: {
      date: Date;
      memo?: string;
      lines: { accountId: string; debit: number; credit: number; description?: string }[];
    },
    actorId?: string,
  ) {
    const draft = await this.create(
      {
        date: input.date,
        memo: input.memo,
        lines: input.lines,
      },
      actorId,
    );
    return this.post(draft.id, actorId);
  }

  validateLines(
    lines: { debit: number; credit: number }[],
  ): void {
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new BadRequestException('Debit and credit must be non-negative');
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(
          'A line cannot have both debit and credit',
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new BadRequestException(
          'Each line must have a debit or credit amount',
        );
      }
    }
  }

  assertBalanced(lines: { debit: { toNumber(): number } | number; credit: { toNumber(): number } | number }[]): void {
    const debits = sumDebits(lines);
    const credits = sumCredits(lines);
    if (debits <= 0 || credits <= 0) {
      throw new BadRequestException(
        'Journal entry must have non-zero debits and credits',
      );
    }
    if (roundMoney(debits) !== roundMoney(credits)) {
      throw new BadRequestException(
        `Journal entry is unbalanced: debits=${debits}, credits=${credits}`,
      );
    }
  }
}
