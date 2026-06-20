export const EVENT_BUS_STREAM_KEY = 'anc:event-bus';

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  topic: string;
  entityId: string;
  orgId?: string;
  actorId?: string;
  timestamp: string;
  version: number;
  payload: TPayload;
}

export interface EventHandler<TPayload = Record<string, unknown>> {
  (event: EventEnvelope<TPayload>): Promise<void> | void;
}

export interface EventBus {
  publish<TPayload extends Record<string, unknown>>(
    topic: string,
    payload: Omit<EventEnvelope<TPayload>, 'topic' | 'timestamp' | 'version'> &
      Partial<Pick<EventEnvelope<TPayload>, 'timestamp' | 'version'>>,
  ): Promise<string>;

  subscribe<TPayload extends Record<string, unknown>>(
    topic: string,
    handler: EventHandler<TPayload>,
    options?: { consumerGroup?: string; consumerName?: string },
  ): Promise<() => Promise<void>>;
}
