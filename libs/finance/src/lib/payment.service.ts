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
import {
  RecordBillPaymentInput,
  RecordInvoicePaymentInput,
} from './schemas';
import { roundMoney, toNumber } from './utils';

function mapPayment(payment: {
  id: string;
  type: string;
  invoiceId: string | null;
  billId: string | null;
  amount: { toNumber(): number } | number;
  date: Date;
  method: string | null;
  journalEntryId: string | null;
  createdAt: Date;
}) {
  return {
    ...payment,
    amount: toNumber(payment.amount),
  };
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accountService: AccountService,
    private readonly journalService: JournalService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async recordInvoicePayment(
    input: RecordInvoicePaymentInput,
    actorId?: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${input.invoiceId} not found`);
    }
    if (invoice.status === 'DRAFT' || invoice.status === 'VOIDED') {
      throw new BadRequestException(
        `Cannot pay invoice with status ${invoice.status}`,
      );
    }
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const total = toNumber(invoice.total);
    const paid = toNumber(invoice.amountPaid);
    const remaining = roundMoney(total - paid);
    if (input.amount > remaining) {
      throw new BadRequestException(
        `Payment ${input.amount} exceeds amount due ${remaining}`,
      );
    }

    const cashAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.CASH,
    );
    const arAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.ACCOUNTS_RECEIVABLE,
    );

    const journalEntry = await this.journalService.createAndPost(
      {
        date: input.date,
        memo: `Payment on invoice ${invoice.invoiceNumber}`,
        lines: [
          {
            accountId: cashAccount.id,
            debit: input.amount,
            credit: 0,
            description: 'Cash received',
          },
          {
            accountId: arAccount.id,
            debit: 0,
            credit: input.amount,
            description: `AR payment — ${invoice.invoiceNumber}`,
          },
        ],
      },
      actorId,
    );

    const newPaid = roundMoney(paid + input.amount);
    const newStatus =
      newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';

    const payment = await this.prisma.payment.create({
      data: {
        type: 'INVOICE',
        invoiceId: invoice.id,
        amount: input.amount,
        date: input.date,
        method: input.method?.trim() || null,
        journalEntryId: journalEntry.id,
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, status: newStatus },
    });

    await this.audit.record({
      actorId,
      action: 'record_payment',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        invoiceId: invoice.id,
        amount: input.amount,
      },
    });

    await this.eventBus.publish(FINANCE_EVENTS.payment.recorded, {
      entityId: payment.id,
      actorId,
      payload: {
        type: 'INVOICE',
        invoiceId: invoice.id,
        amount: input.amount,
      },
    });

    if (newStatus === 'PAID') {
      await this.eventBus.publish(FINANCE_EVENTS.invoice.paid, {
        entityId: invoice.id,
        actorId,
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          totalPaid: newPaid,
        },
      });
    }

    return mapPayment(payment);
  }

  async recordBillPayment(input: RecordBillPaymentInput, actorId?: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id: input.billId },
    });
    if (!bill) {
      throw new NotFoundException(`Bill ${input.billId} not found`);
    }
    if (bill.status === 'DRAFT' || bill.status === 'VOIDED') {
      throw new BadRequestException(
        `Cannot pay bill with status ${bill.status}`,
      );
    }
    if (bill.status === 'PAID') {
      throw new BadRequestException('Bill is already fully paid');
    }

    const total = toNumber(bill.total);
    const paid = toNumber(bill.amountPaid);
    const remaining = roundMoney(total - paid);
    if (input.amount > remaining) {
      throw new BadRequestException(
        `Payment ${input.amount} exceeds amount due ${remaining}`,
      );
    }

    const cashAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.CASH,
    );
    const apAccount = await this.accountService.getByCode(
      DEFAULT_ACCOUNTS.ACCOUNTS_PAYABLE,
    );

    const journalEntry = await this.journalService.createAndPost(
      {
        date: input.date,
        memo: `Payment on bill ${bill.billNumber}`,
        lines: [
          {
            accountId: apAccount.id,
            debit: input.amount,
            credit: 0,
            description: `AP payment — ${bill.billNumber}`,
          },
          {
            accountId: cashAccount.id,
            debit: 0,
            credit: input.amount,
            description: 'Cash paid',
          },
        ],
      },
      actorId,
    );

    const newPaid = roundMoney(paid + input.amount);
    const newStatus = newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';

    const payment = await this.prisma.payment.create({
      data: {
        type: 'BILL',
        billId: bill.id,
        amount: input.amount,
        date: input.date,
        method: input.method?.trim() || null,
        journalEntryId: journalEntry.id,
      },
    });

    await this.prisma.bill.update({
      where: { id: bill.id },
      data: { amountPaid: newPaid, status: newStatus },
    });

    await this.audit.record({
      actorId,
      action: 'record_payment',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { billId: bill.id, amount: input.amount },
    });

    await this.eventBus.publish(FINANCE_EVENTS.payment.recorded, {
      entityId: payment.id,
      actorId,
      payload: { type: 'BILL', billId: bill.id, amount: input.amount },
    });

    if (newStatus === 'PAID') {
      await this.eventBus.publish(FINANCE_EVENTS.bill.paid, {
        entityId: bill.id,
        actorId,
        payload: { billNumber: bill.billNumber, totalPaid: newPaid },
      });
    }

    return mapPayment(payment);
  }
}
