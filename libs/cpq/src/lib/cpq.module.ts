import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { CpqCatalogService } from './catalog.service';
import { QuoteService } from './quote.service';

@Module({
  imports: [AuditModule],
  providers: [CpqCatalogService, QuoteService],
  exports: [CpqCatalogService, QuoteService],
})
export class CpqModule {}
