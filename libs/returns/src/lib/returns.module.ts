import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { FinanceModule } from 'finance';
import { QmsModule } from 'qms';
import { WmsModule } from 'wms';
import { ReturnsService } from './returns.service';

@Module({
  imports: [AuditModule, WmsModule, QmsModule, FinanceModule],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
