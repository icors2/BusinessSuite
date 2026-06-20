import { Injectable, Logger } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from 'database';
import Redis from 'ioredis';
import {
  HeadBucketCommand,
  S3Client,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { AppConfig } from 'config';

@Injectable()
export class PostgresHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Postgres check failed',
        this.getStatus(key, false, { message: String(error) }),
      );
    }
  }
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisUrl: string) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redis = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });

    try {
      const pong = await redis.ping();
      return this.getStatus(key, pong === 'PONG');
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: String(error) }),
      );
    } finally {
      await redis.quit();
    }
  }
}

@Injectable()
export class MinioHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(MinioHealthIndicator.name);

  constructor(private readonly config: AppConfig) {
    super();
  }

  private createClient(): S3Client {
    const { endpoint, port, accessKey, secretKey, useSsl } = this.config.minio;
    return new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const client = this.createClient();
    const { bucket } = this.config.minio;

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return this.getStatus(key, true);
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        return this.getStatus(key, true, { createdBucket: true });
      } catch (error) {
        throw new HealthCheckError(
          'MinIO check failed',
          this.getStatus(key, false, { message: String(error) }),
        );
      }
    }
  }
}

@Injectable()
export class HealthAlertService {
  private readonly logger = new Logger(HealthAlertService.name);

  notifyFailure(details: Record<string, unknown>): void {
    // Log-based alert hook — replace with PagerDuty/Opsgenie/etc. in production.
    this.logger.error(
      `[HEALTH_ALERT] Dependency check failed: ${JSON.stringify(details)}`,
    );
  }
}
