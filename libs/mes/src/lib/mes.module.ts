import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { WorkforceModule } from 'workforce';
import { MesGateway } from './mes.gateway';
import { MesService } from './mes.service';

@Module({
  imports: [AuditModule, WorkforceModule],
  providers: [MesService, MesGateway],
  exports: [MesService, MesGateway],
})
export class MesModule {}
