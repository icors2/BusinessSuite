import { DynamicModule, Global, Module } from '@nestjs/common';
import { AppConfig } from 'config';
import { APP_CONFIG } from './storage.constants';
import { StorageService } from './storage.service';

export { APP_CONFIG } from './storage.constants';

@Global()
@Module({})
export class StorageModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
