import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { JwtPayload } from 'auth';
import { loadAppConfig } from 'config';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { ALL_MES_TOPICS, MES_EVENTS } from './events';

const config = loadAppConfig();

@WebSocketGateway({
  namespace: '/mes',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class MesGateway implements OnGatewayInit, OnModuleInit {
  private readonly logger = new Logger(MesGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      const token =
        (socket.handshake.auth?.['token'] as string | undefined) ??
        (socket.handshake.query?.['token'] as string | undefined);
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }
      try {
        const payload = jwt.verify(
          token,
          config.jwt.accessSecret,
        ) as JwtPayload;
        socket.data.user = {
          userId: payload.sub,
          email: payload.email,
          roles: payload.roles,
        };
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env['SKIP_MES_GATEWAY'] === 'true') {
      this.logger.log('MES gateway Redis subscriptions skipped (SKIP_MES_GATEWAY)');
      return;
    }

    for (const topic of ALL_MES_TOPICS) {
      await this.eventBus.subscribe(
        topic,
        (envelope) => {
          this.broadcast(topic, envelope);
        },
        { consumerGroup: 'mes-realtime', consumerName: `mes-gw-${process.pid}` },
      );
    }
    this.logger.log('MES gateway subscribed to mes.* topics');
  }

  broadcast(_topic: string, envelope: EventEnvelope): void {
    if (!this.server) {
      return;
    }
    this.server.emit('mes.event', envelope);
  }
}
