import { Module } from '@nestjs/common';
import { AuditModule } from 'audit';
import { CustomerService } from './customer.service';
import { MasterdataLogSubscriber } from './masterdata-log.subscriber';
import { ProductService } from './product.service';
import { VendorService } from './vendor.service';

@Module({
  imports: [AuditModule],
  providers: [
    ProductService,
    CustomerService,
    VendorService,
    MasterdataLogSubscriber,
  ],
  exports: [ProductService, CustomerService, VendorService],
})
export class MasterdataModule {}
