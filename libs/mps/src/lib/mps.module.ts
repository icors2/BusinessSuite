import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { WmsModule } from 'wms';
import { MpsService } from './mps.service';
import { SalesDemandSubscriber } from './sales-demand.subscriber';

@Module({
  imports: [AuditModule, WmsModule],
  providers: [MpsService, SalesDemandSubscriber],
  exports: [MpsService],
})
export class MpsModule {}
