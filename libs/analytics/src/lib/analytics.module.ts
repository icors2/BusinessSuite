import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { AnalyticsIngestionSubscriber } from './analytics-ingestion.subscriber';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AuditModule],
  providers: [AnalyticsService, AnalyticsIngestionSubscriber],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
