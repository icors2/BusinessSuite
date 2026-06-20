import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CPQ_EVENTS } from 'cpq';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { SalesOrderService } from './sales-order.service';

interface QuoteAcceptedPayload {
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  total: number;
  currency: string;
  lines: unknown[];
}

@Injectable()
export class QuoteAcceptedSubscriber implements OnModuleInit {
  private readonly logger = new Logger(QuoteAcceptedSubscriber.name);

  constructor(
    private readonly salesOrderService: SalesOrderService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['SKIP_SALES_SUBSCRIBER'] === 'true'
    ) {
      return;
    }

    await this.eventBus.subscribe(
      CPQ_EVENTS.quote.accepted,
      async (event: EventEnvelope) => {
        const payload = event.payload as unknown as QuoteAcceptedPayload;
        const { quoteId } = payload;
        this.logger.log(
          `Converting accepted quote ${payload.quoteNumber} to sales order`,
        );
        await this.salesOrderService.convertFromQuote(
          { quoteId },
          event.actorId,
        );
      },
      { consumerGroup: 'sales-orders' },
    );

    this.logger.log(`Subscribed to ${CPQ_EVENTS.quote.accepted}`);
  }
}
