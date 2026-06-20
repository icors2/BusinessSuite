import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { WmsModule } from 'wms';
import { ProcurementService } from './procurement.service';

@Module({
  imports: [AuditModule, WmsModule],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
