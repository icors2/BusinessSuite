import { RedisStreamEventBus } from './redis-stream-event-bus';
import Redis from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

async function isRedisAvailable(): Promise<boolean> {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
  });

  try {
    const pong = await client.ping();
    await client.quit();
    return pong === 'PONG';
  } catch (error) {
    console.warn('Redis unavailable for integration tests:', error);
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    return false;
  }
}

describe('RedisStreamEventBus', () => {
  let bus: RedisStreamEventBus | undefined;
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      bus = new RedisStreamEventBus(REDIS_URL);
    }
  }, 15000);

  afterAll(async () => {
    if (bus) {
      await bus.onModuleDestroy();
    }
  });

  it(
    'publishes and receives events in a round-trip',
    async () => {
      if (!redisAvailable || !bus) {
        throw new Error('Redis is required for event-bus round-trip test');
      }

      const topic = `test.event.published.${Date.now()}`;
      const received: unknown[] = [];

      const stop = await bus.subscribe(
        topic,
        async (event) => {
          received.push(event);
        },
        {
          consumerGroup: `test-group-${Date.now()}`,
          consumerName: `test-consumer-${Date.now()}`,
        },
      );

      await bus.publish(topic, {
        entityId: 'entity-1',
        actorId: 'actor-1',
        payload: { hello: 'world' },
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      await stop();

      expect(received.length).toBeGreaterThanOrEqual(1);
      expect(received[0]).toMatchObject({
        topic,
        entityId: 'entity-1',
        actorId: 'actor-1',
        payload: { hello: 'world' },
        version: 1,
      });
    },
    15000,
  );
});
