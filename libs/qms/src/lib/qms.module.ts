import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { QmsService } from './qms.service';

@Module({
  imports: [AuditModule],
  providers: [QmsService],
  exports: [QmsService],
})
export class QmsModule {}
