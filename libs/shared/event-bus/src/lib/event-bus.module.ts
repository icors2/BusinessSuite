import { DynamicModule, Module } from '@nestjs/common';
import { RedisStreamEventBus } from './redis-stream-event-bus';
import { EventBus } from './event-bus.types';

export const EVENT_BUS = Symbol('EVENT_BUS');

@Module({})
export class EventBusModule {
  static forRoot(redisUrl: string): DynamicModule {
    return {
      module: EventBusModule,
      global: true,
      providers: [
        {
          provide: EVENT_BUS,
          useFactory: (): EventBus => new RedisStreamEventBus(redisUrl),
        },
      ],
      exports: [EVENT_BUS],
    };
  }
}
