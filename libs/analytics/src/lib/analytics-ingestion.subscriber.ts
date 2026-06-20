import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { AnalyticsService } from './analytics.service';
import { ALL_INGESTED_TOPICS } from './ingested-topics';

@Injectable()
export class AnalyticsIngestionSubscriber implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsIngestionSubscriber.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['SKIP_ANALYTICS_SUBSCRIBER'] === 'true'
    ) {
      return;
    }

    for (const topic of ALL_INGESTED_TOPICS) {
      await this.eventBus.subscribe(
        topic,
        async (event: EventEnvelope) => {
          await this.analyticsService.recordEvent(event);
        },
        { consumerGroup: 'analytics-ingest', consumerName: `analytics-${topic}` },
      );
    }

    this.logger.log(
      `Subscribed to ${ALL_INGESTED_TOPICS.length} topics (consumer group analytics-ingest)`,
    );
  }
}
