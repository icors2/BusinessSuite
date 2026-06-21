import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { WorkforceModule } from 'workforce';
import { AdminService } from './admin.service';

@Module({
  imports: [AuditModule, WorkforceModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
