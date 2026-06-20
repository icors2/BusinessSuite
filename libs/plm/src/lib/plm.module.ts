import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { DocumentService } from './document.service';

@Module({
  imports: [AuditModule],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class PlmModule {}
