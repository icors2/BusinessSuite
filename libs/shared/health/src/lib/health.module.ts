import { DynamicModule, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfig } from 'config';
import { HealthController } from './health.controller';
import {
  HealthAlertService,
  MinioHealthIndicator,
  PostgresHealthIndicator,
  RedisHealthIndicator,
} from './health.indicators';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Module({})
export class HealthModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        PostgresHealthIndicator,
        {
          provide: RedisHealthIndicator,
          useFactory: () => new RedisHealthIndicator(config.redisUrl),
        },
        {
          provide: MinioHealthIndicator,
          useFactory: () => new MinioHealthIndicator(config),
        },
        HealthAlertService,
      ],
    };
  }
}
