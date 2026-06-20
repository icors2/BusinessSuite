import { Module } from '@nestjs/common';
import { loadAppConfig } from 'config';
import { DatabaseModule } from 'database';
import { EventBusModule } from 'event-bus';
import { AuditModule } from 'audit';
import { HealthModule } from 'health';
import { AuthModule } from 'auth';
import { MasterdataModule } from 'masterdata';
import { AppController } from './app.controller';

const config = loadAppConfig();

@Module({
  imports: [
    DatabaseModule,
    EventBusModule.forRoot(config.redisUrl),
    AuditModule,
    HealthModule.forRoot(config),
    AuthModule.forRoot(config),
    MasterdataModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
