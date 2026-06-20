import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { CmmsCycleSubscriber } from './cmms-cycle.subscriber';
import { CmmsService } from './cmms.service';

@Module({
  imports: [AuditModule],
  providers: [CmmsService, CmmsCycleSubscriber],
  exports: [CmmsService],
})
export class CmmsModule {}
