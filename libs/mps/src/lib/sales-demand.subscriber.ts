import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SALES_EVENTS } from 'sales';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { MpsService } from './mps.service';

interface SalesOrderCreatedPayload {
  orderId: string;
  orderNumber: string;
}

@Injectable()
export class SalesDemandSubscriber implements OnModuleInit {
  private readonly logger = new Logger(SalesDemandSubscriber.name);

  constructor(
    private readonly mpsService: MpsService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['SKIP_MPS_SUBSCRIBER'] === 'true'
    ) {
      return;
    }

    await this.eventBus.subscribe(
      SALES_EVENTS.order.created,
      async (event: EventEnvelope) => {
        const payload = event.payload as unknown as SalesOrderCreatedPayload;
        this.logger.log(
          `Refreshing MPS demand preview after sales order ${payload.orderNumber}`,
        );
        await this.mpsService.previewDemand();
      },
      { consumerGroup: 'mps-demand' },
    );

    this.logger.log(`Subscribed to ${SALES_EVENTS.order.created}`);
  }
}
