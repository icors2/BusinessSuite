import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { WorkforceService } from './workforce.service';

@Module({
  imports: [AuditModule],
  providers: [WorkforceService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
