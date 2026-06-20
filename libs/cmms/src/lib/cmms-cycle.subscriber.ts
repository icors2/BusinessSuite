import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MES_EVENTS } from 'mes';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { PrismaService } from 'database';
import { CmmsService } from './cmms.service';

interface CycleRecordedPayload {
  cycleId: string;
  operationId: string;
  employeeId: string;
  durationMinutes?: number;
  quantityCompleted?: number;
  quantityScrapped?: number;
}

@Injectable()
export class CmmsCycleSubscriber implements OnModuleInit {
  private readonly logger = new Logger(CmmsCycleSubscriber.name);

  constructor(
    private readonly cmmsService: CmmsService,
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['SKIP_CMMS_SUBSCRIBER'] === 'true'
    ) {
      return;
    }

    await this.eventBus.subscribe(
      MES_EVENTS.cycle.recorded,
      async (event: EventEnvelope) => {
        const payload = event.payload as unknown as CycleRecordedPayload;
        const operation = await this.prisma.workOrderOperation.findUnique({
          where: { id: payload.operationId },
          select: { workstationId: true },
        });

        if (!operation?.workstationId) {
          this.logger.debug(
            `Skipping CMMS cycle handler — no workstation for operation ${payload.operationId}`,
          );
          return;
        }

        this.logger.log(
          `Recording cycle for workstation ${operation.workstationId} (operation ${payload.operationId})`,
        );
        await this.cmmsService.recordCycleForWorkstation(operation.workstationId);
      },
      { consumerGroup: 'cmms-pm' },
    );

    this.logger.log(`Subscribed to ${MES_EVENTS.cycle.recorded}`);
  }
}
