import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  EVENT_BUS_STREAM_KEY,
  EventBus,
  EventEnvelope,
  EventHandler,
} from './event-bus.types';

@Injectable()
export class RedisStreamEventBus implements EventBus, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamEventBus.name);
  /** Commands: XADD, XGROUP, XACK */
  private readonly redis: Redis;
  /** Blocking reads only — avoids starving XGROUP during subscriber startup */
  private readonly blockingRedis: Redis;
  private readonly stopHandlers = new Map<string, () => Promise<void>>();

  constructor(redisUrl: string) {
    const options = { maxRetriesPerRequest: null } as const;
    this.redis = new Redis(redisUrl, options);
    this.blockingRedis = new Redis(redisUrl, options);
  }

  async publish<TPayload extends Record<string, unknown>>(
    topic: string,
    payload: Omit<EventEnvelope<TPayload>, 'topic' | 'timestamp' | 'version'> &
      Partial<Pick<EventEnvelope<TPayload>, 'timestamp' | 'version'>>,
  ): Promise<string> {
    const envelope: EventEnvelope<TPayload> = {
      topic,
      entityId: payload.entityId,
      orgId: payload.orgId,
      actorId: payload.actorId,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      version: payload.version ?? 1,
      payload: payload.payload,
    };

    const messageId = await this.redis.xadd(
      EVENT_BUS_STREAM_KEY,
      '*',
      'topic',
      envelope.topic,
      'data',
      JSON.stringify(envelope),
    );

    if (!messageId) {
      throw new Error('Failed to publish event to Redis stream');
    }

    return messageId;
  }

  async subscribe<TPayload extends Record<string, unknown>>(
    topic: string,
    handler: EventHandler<TPayload>,
    options?: { consumerGroup?: string; consumerName?: string },
  ): Promise<() => Promise<void>> {
    const consumerGroup = options?.consumerGroup ?? 'anc-default';
    const consumerName =
      options?.consumerName ?? `consumer-${process.pid}-${Date.now()}`;

    try {
      await this.redis.xgroup(
        'CREATE',
        EVENT_BUS_STREAM_KEY,
        consumerGroup,
        '0',
        'MKSTREAM',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('BUSYGROUP')) {
        throw error;
      }
    }

    let running = true;

    const poll = async (): Promise<void> => {
      while (running) {
        const results = await this.blockingRedis.xreadgroup(
          'GROUP',
          consumerGroup,
          consumerName,
          'COUNT',
          10,
          'BLOCK',
          2000,
          'STREAMS',
          EVENT_BUS_STREAM_KEY,
          '>',
        );

        if (!results) {
          continue;
        }

        const streamResults = results as [string, [string, string[]][]][];

        for (const [, messages] of streamResults) {
          for (const [id, fields] of messages) {
            const dataIndex = fields.indexOf('data');
            const rawData = dataIndex >= 0 ? fields[dataIndex + 1] : undefined;

            if (!rawData) {
              await this.redis.xack(EVENT_BUS_STREAM_KEY, consumerGroup, id);
              continue;
            }

            const envelope = JSON.parse(rawData) as EventEnvelope<TPayload>;

            try {
              if (envelope.topic === topic) {
                await handler(envelope);
              }
            } catch (error) {
              this.logger.error(
                `Event bus handler error for topic ${topic} (message ${id})`,
                error,
              );
            } finally {
              await this.redis.xack(EVENT_BUS_STREAM_KEY, consumerGroup, id);
            }
          }
        }
      }
    };

    void poll().catch((error) => {
      this.logger.error(`Event bus poll loop stopped for topic ${topic}`, error);
    });

    const stop = async (): Promise<void> => {
      running = false;
    };

    this.stopHandlers.set(`${topic}:${consumerName}`, stop);
    return stop;
  }

  async onModuleDestroy(): Promise<void> {
    for (const stop of this.stopHandlers.values()) {
      await stop();
    }
    await Promise.all([this.redis.quit(), this.blockingRedis.quit()]);
  }
}
