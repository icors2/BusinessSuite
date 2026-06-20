import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { AccountService } from './account.service';
import { BillService } from './bill.service';
import { InvoiceService } from './invoice.service';
import { JournalService } from './journal.service';
import { PaymentService } from './payment.service';
import { ReportService } from './report.service';

@Module({
  imports: [AuditModule],
  providers: [
    AccountService,
    JournalService,
    InvoiceService,
    BillService,
    PaymentService,
    ReportService,
  ],
  exports: [
    AccountService,
    JournalService,
    InvoiceService,
    BillService,
    PaymentService,
    ReportService,
  ],
})
export class FinanceModule {}
