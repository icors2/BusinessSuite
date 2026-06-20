import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { FinanceModule } from 'finance';
import { WmsModule } from 'wms';
import { QuoteAcceptedSubscriber } from './quote-accepted.subscriber';
import { SalesOrderService } from './sales-order.service';

@Module({
  imports: [AuditModule, WmsModule, FinanceModule],
  providers: [SalesOrderService, QuoteAcceptedSubscriber],
  exports: [SalesOrderService],
})
export class SalesModule {}
