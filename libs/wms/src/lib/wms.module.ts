import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { InventoryService } from './inventory.service';
import { LocationService } from './location.service';

@Module({
  imports: [AuditModule],
  providers: [LocationService, InventoryService],
  exports: [LocationService, InventoryService],
})
export class WmsModule {}
