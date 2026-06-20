import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { Public } from 'auth';
import {
  HealthAlertService,
  MinioHealthIndicator,
  PostgresHealthIndicator,
  RedisHealthIndicator,
} from './health.indicators';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly minio: MinioHealthIndicator,
    private readonly alerts: HealthAlertService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    try {
      return await this.health.check([
        () => this.postgres.isHealthy('postgres'),
        () => this.redis.isHealthy('redis'),
        () => this.minio.isHealthy('minio'),
      ]);
    } catch (error) {
      this.alerts.notifyFailure({ error: String(error) });
      throw error;
    }
  }
}
