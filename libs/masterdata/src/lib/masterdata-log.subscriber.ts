import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { ALL_MASTERDATA_TOPICS } from './events';

@Injectable()
export class MasterdataLogSubscriber implements OnModuleInit {
  private readonly logger = new Logger(MasterdataLogSubscriber.name);

  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

  async onModuleInit(): Promise<void> {
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['SKIP_MASTERDATA_EVENT_LOG'] === 'true'
    ) {
      return;
    }

    for (const topic of ALL_MASTERDATA_TOPICS) {
      await this.eventBus.subscribe(topic, (event: EventEnvelope) => {
        this.logger.log(
          `[masterdata-event] ${event.topic} entity=${event.entityId} actor=${event.actorId ?? 'system'}`,
        );
      });
    }
    this.logger.log(
      `Subscribed to ${ALL_MASTERDATA_TOPICS.length} masterdata event topics`,
    );
  }
}
