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
import { CpqModule } from 'cpq';
import { SalesModule } from 'sales';
import { MpsModule } from 'mps';
import { MrpModule } from 'mrp';
import { ProcurementModule } from 'procurement';
import { WorkforceModule } from 'workforce';
import { MesModule } from 'mes';
import { QmsModule } from 'qms';
import { CmmsModule } from 'cmms';
import { MesVerificationController } from './mes-verification.controller';
import { QmsInspectionController } from './qms-inspection.controller';
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
    CpqModule,
    SalesModule,
    MpsModule,
    MrpModule,
    ProcurementModule,
    WorkforceModule,
    MesModule,
    QmsModule,
    CmmsModule,
  ],
  controllers: [
    AppController,
    DocumentsController,
    MesVerificationController,
    QmsInspectionController,
  ],
})
export class AppModule {}
