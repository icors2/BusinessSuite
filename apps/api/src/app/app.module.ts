import { Module } from '@nestjs/common';
import { loadAppConfig } from 'config';
import { DatabaseModule } from 'database';
import { EventBusModule } from 'event-bus';
import { AuditModule } from 'audit';
import { HealthModule } from 'health';
import { AuthModule } from 'auth';
import { MasterdataModule } from 'masterdata';
import { FinanceModule } from 'finance';
import { PlmModule } from 'plm';
import { StorageModule } from 'storage';
import { WmsModule } from 'wms';
import { AppController } from './app.controller';
import { DocumentsController } from './documents.controller';

const config = loadAppConfig();

@Module({
  imports: [
    DatabaseModule,
    EventBusModule.forRoot(config.redisUrl),
    AuditModule,
    HealthModule.forRoot(config),
    AuthModule.forRoot(config),
    StorageModule.forRoot(config),
    MasterdataModule,
    FinanceModule,
    PlmModule,
    WmsModule,
  ],
  controllers: [AppController, DocumentsController],
})
export class AppModule {}
