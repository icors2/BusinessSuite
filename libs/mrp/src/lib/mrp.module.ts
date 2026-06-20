import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { WmsModule } from 'wms';
import { MrpService } from './mrp.service';

@Module({
  imports: [AuditModule, WmsModule],
  providers: [MrpService],
  exports: [MrpService],
})
export class MrpModule {}
