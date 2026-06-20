import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus, EventEnvelope } from 'event-bus';
import { scoreBottlenecks, StationMetrics } from './bottleneck';
import { ANALYTICS_EVENTS } from './events';
import {
  avgDailyDemand,
  projectDepletion,
  recommendedReorder,
} from './forecasting';
import { ALL_INGESTED_TOPICS, topicModule } from './ingested-topics';
import {
  computeScrapRate,
  NlqParseResult,
  parseQuestion,
  parseTimeRange,
  SUPPORTED_QUESTIONS,
} from './nlq';
import {
  EventVolumeInput,
  GetForecastsInput,
  ScrapRateInput,
} from './schemas';

const DEFAULT_DEMAND_WINDOW_DAYS = 30;

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

function defaultRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - DEFAULT_DEMAND_WINDOW_DAYS);
  return { from, to };
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async recordEvent(envelope: EventEnvelope): Promise<void> {
    const dedupeKey = `${envelope.topic}:${envelope.entityId}:${envelope.timestamp}`;
    const module = topicModule(envelope.topic);

    await this.prisma.analyticsEvent.upsert({
      where: { dedupeKey },
      create: {
        topic: envelope.topic,
        module,
        entityId: envelope.entityId,
        actorId: envelope.actorId ?? null,
        occurredAt: new Date(envelope.timestamp),
        payload: envelope.payload as Prisma.InputJsonValue,
        dedupeKey,
      },
      update: {},
    });
  }

  async getIngestionStatus() {
    const grouped = await this.prisma.analyticsEvent.groupBy({
      by: ['topic'],
      _count: { topic: true },
    });

    const counts = new Map(grouped.map((g) => [g.topic, g._count.topic]));
    const topics = ALL_INGESTED_TOPICS.map((topic) => ({
      topic,
      count: counts.get(topic) ?? 0,
      ingested: (counts.get(topic) ?? 0) > 0,
    }));

    const missingTopics = topics.filter((t) => !t.ingested).map((t) => t.topic);
    const totalEvents = await this.prisma.analyticsEvent.count();

    return {
      totalEvents,
      topics,
      missingTopics,
      complete: missingTopics.length === 0,
    };
  }

  async getEventVolume(input: EventVolumeInput = {}) {
    const range = input.from && input.to
      ? { from: input.from, to: input.to }
      : defaultRange();

    const where: Prisma.AnalyticsEventWhereInput = {
      occurredAt: { gte: range.from, lte: range.to },
    };
    if (input.topic) {
      where.topic = input.topic;
    }

    const events = await this.prisma.analyticsEvent.findMany({
      where,
      select: { topic: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    });

    const byTopic = new Map<string, number>();
    const byDay = new Map<string, number>();

    for (const evt of events) {
      byTopic.set(evt.topic, (byTopic.get(evt.topic) ?? 0) + 1);
      const day = evt.occurredAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    return {
      range,
      total: events.length,
      byTopic: [...byTopic.entries()].map(([topic, count]) => ({ topic, count })),
      byDay: [...byDay.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      freshness: 'real-time',
    };
  }

  async getScrapRate(input: ScrapRateInput = {}) {
    const range = input.from && input.to
      ? { from: input.from, to: input.to }
      : parseTimeRange('last month') ?? defaultRange();

    const cycles = await this.prisma.cycleRecord.findMany({
      where: {
        startedAt: { gte: range.from, lte: range.to },
        ...(input.sku
          ? {
              operation: {
                workOrder: {
                  product: { sku: input.sku },
                },
              },
            }
          : {}),
      },
      include: {
        operation: {
          include: {
            workOrder: {
              include: { product: { select: { id: true, sku: true, description: true } } },
            },
          },
        },
      },
    });

    let scrapped = 0;
    let completed = 0;
    const byProduct = new Map<
      string,
      { sku: string; description: string; scrapped: number; completed: number }
    >();

    for (const cycle of cycles) {
      const s = toNumber(cycle.quantityScrapped);
      const c = toNumber(cycle.quantityCompleted);
      scrapped += s;
      completed += c;

      if (input.byProduct && cycle.operation?.workOrder?.product) {
        const product = cycle.operation.workOrder.product;
        const existing = byProduct.get(product.id) ?? {
          sku: product.sku,
          description: product.description,
          scrapped: 0,
          completed: 0,
        };
        existing.scrapped += s;
        existing.completed += c;
        byProduct.set(product.id, existing);
      }
    }

    const rate = computeScrapRate(scrapped, completed);

    return {
      range,
      scrapped,
      completed,
      scrapRate: rate,
      scrapRatePct: Math.round(rate * 10000) / 100,
      byProduct: input.byProduct
        ? [...byProduct.values()].map((p) => ({
            ...p,
            scrapRate: computeScrapRate(p.scrapped, p.completed),
            scrapRatePct:
              Math.round(computeScrapRate(p.scrapped, p.completed) * 10000) / 100,
          }))
        : undefined,
      freshness: 'near-real-time',
    };
  }

  async getBottlenecks() {
    const workstations = await this.prisma.workstation.findMany({
      where: { status: 'ACTIVE' },
      include: {
        operations: {
          where: { status: 'IN_PROGRESS' },
          include: {
            cycles: {
              where: { durationMinutes: { not: null } },
              take: 50,
              orderBy: { startedAt: 'desc' },
            },
          },
        },
      },
    });

    const stations: StationMetrics[] = workstations.map((ws) => {
      const wip = ws.operations.length;
      const durations = ws.operations.flatMap((op) =>
        op.cycles.map((c) => c.durationMinutes ?? 0).filter((d) => d > 0),
      );
      const avgCycleMinutes =
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

      return {
        workstationId: ws.id,
        workstationCode: ws.code,
        workstationName: ws.name,
        wip,
        avgCycleMinutes: Math.round(avgCycleMinutes * 100) / 100,
      };
    });

    const results = scoreBottlenecks(stations);
    const bottlenecks = results.filter((r) => r.isBottleneck);

    return {
      stations: results,
      bottlenecks,
      freshness: 'near-real-time',
    };
  }

  async computeInventoryForecasts(actorId?: string) {
    const asOf = new Date();
    asOf.setUTCHours(0, 0, 0, 0);
    const windowStart = new Date(asOf);
    windowStart.setUTCDate(windowStart.getUTCDate() - DEFAULT_DEMAND_WINDOW_DAYS);

    const products = await this.prisma.product.findMany({
      where: { active: true, deletedAt: null },
      include: {
        inventory: { select: { onHand: true } },
        salesOrderLines: {
          where: { qtyShipped: { gt: 0 } },
          select: { qtyShipped: true, updatedAt: true },
        },
      },
    });

    const forecasts = [];

    for (const product of products) {
      const shippedInWindow = product.salesOrderLines
        .filter((l) => l.updatedAt >= windowStart)
        .reduce((sum, l) => sum + toNumber(l.qtyShipped), 0);

      const avgDaily = avgDailyDemand(shippedInWindow, DEFAULT_DEMAND_WINDOW_DAYS);
      const onHand = product.inventory.reduce(
        (sum, inv) => sum + toNumber(inv.onHand),
        0,
      );
      const depletion = projectDepletion(onHand, avgDaily, asOf);
      const reorder = recommendedReorder(depletion, product.leadTimeDays);

      const row = await this.prisma.inventoryForecast.upsert({
        where: {
          productId_asOfDate: { productId: product.id, asOfDate: asOf },
        },
        create: {
          productId: product.id,
          asOfDate: asOf,
          avgDailyDemand: avgDaily,
          onHand,
          projectedDepletionDate: depletion,
          recommendedReorderDate: reorder,
          leadTimeDays: product.leadTimeDays,
        },
        update: {
          avgDailyDemand: avgDaily,
          onHand,
          projectedDepletionDate: depletion,
          recommendedReorderDate: reorder,
          leadTimeDays: product.leadTimeDays,
          computedAt: new Date(),
        },
        include: { product: { select: { sku: true, description: true } } },
      });

      forecasts.push(row);
    }

    await this.audit.record({
      actorId,
      action: 'analytics.forecast.computed',
      entityType: 'InventoryForecast',
      entityId: asOf.toISOString(),
      metadata: { count: forecasts.length, asOfDate: asOf.toISOString() },
    });

    await this.eventBus.publish(ANALYTICS_EVENTS.forecast.computed, {
      entityId: asOf.toISOString(),
      actorId,
      payload: { count: forecasts.length, asOfDate: asOf.toISOString() },
    });

    return {
      asOfDate: asOf,
      count: forecasts.length,
      items: forecasts,
      freshness: 'batch-computed',
    };
  }

  async getForecasts(input: GetForecastsInput = {}) {
    const take = input.take ?? 50;
    const where: Prisma.InventoryForecastWhereInput = {};

    if (input.sku) {
      where.product = { sku: input.sku };
    }

    const items = await this.prisma.inventoryForecast.findMany({
      where,
      take,
      orderBy: [{ asOfDate: 'desc' }, { product: { sku: 'asc' } }],
      include: {
        product: { select: { sku: true, description: true, leadTimeDays: true } },
      },
    });

    return {
      items,
      freshness: 'batch-computed',
      mrpLinkageNote:
        'Reorder recommendations are advisory; full MRP auto-consumption is planned (Phase 9 stub).',
    };
  }

  async answer(question: string) {
    const parsed = parseQuestion(question);

    if (parsed.intent === 'unknown') {
      return {
        intent: 'unknown' as const,
        answer:
          'I could not understand that question. Try one of the supported examples below.',
        supportedQuestions: SUPPORTED_QUESTIONS,
        data: null,
        chart: null,
      };
    }

    return this.executeIntent(parsed, question);
  }

  private async executeIntent(parsed: NlqParseResult, question: string) {
    switch (parsed.intent) {
      case 'scrapRate': {
        const data = await this.getScrapRate({
          from: parsed.params.range?.from,
          to: parsed.params.range?.to,
          sku: parsed.params.sku,
          byProduct: question.toLowerCase().includes('by product'),
        });
        return {
          intent: parsed.intent,
          answer: `Scrap rate is ${data.scrapRatePct}% (${data.scrapped} scrapped / ${data.scrapped + data.completed} total units).`,
          data,
          chart: {
            type: 'bar' as const,
            series: data.byProduct?.map((p) => ({
              label: p.sku,
              value: p.scrapRatePct,
            })) ?? [{ label: 'Overall', value: data.scrapRatePct }],
          },
        };
      }
      case 'bottleneck': {
        const data = await this.getBottlenecks();
        const top = data.bottlenecks[0];
        const answer = top
          ? `Top bottleneck: ${top.workstationCode} (${top.workstationName}) with WIP ${top.wip} and avg cycle ${top.avgCycleMinutes} min.`
          : 'No significant bottlenecks detected.';
        return {
          intent: parsed.intent,
          answer,
          data,
          chart: {
            type: 'bar' as const,
            series: data.stations.map((s) => ({
              label: s.workstationCode,
              value: s.wip,
            })),
          },
        };
      }
      case 'inventoryForecast': {
        const forecasts = await this.getForecasts({ sku: parsed.params.sku });
        const first = forecasts.items[0];
        const answer = first
          ? `Forecast for ${first.product.sku}: on-hand ${toNumber(first.onHand)}, avg daily demand ${toNumber(first.avgDailyDemand).toFixed(2)}, projected depletion ${first.projectedDepletionDate?.toISOString().slice(0, 10) ?? 'N/A'}.`
          : 'No forecasts available. Run recompute first.';
        return {
          intent: parsed.intent,
          answer,
          data: forecasts,
          chart: {
            type: 'table' as const,
            series: forecasts.items.slice(0, 10).map((f) => ({
              label: f.product.sku,
              value: toNumber(f.onHand),
            })),
          },
        };
      }
      case 'returnsCount': {
        const range = parsed.params.range ?? defaultRange();
        const count = await this.prisma.analyticsEvent.count({
          where: {
            topic: 'returns.rma.requested',
            occurredAt: { gte: range.from, lte: range.to },
          },
        });
        return {
          intent: parsed.intent,
          answer: `${count} RMA request(s) in the selected period.`,
          data: { count, range },
          chart: {
            type: 'metric' as const,
            series: [{ label: 'RMA Requests', value: count }],
          },
        };
      }
      case 'eventVolume': {
        const data = await this.getEventVolume({
          from: parsed.params.range?.from,
          to: parsed.params.range?.to,
        });
        return {
          intent: parsed.intent,
          answer: `${data.total} events ingested in the selected period.`,
          data,
          chart: {
            type: 'line' as const,
            series: data.byDay.map((d) => ({ label: d.date, value: d.count })),
          },
        };
      }
      default:
        return {
          intent: 'unknown' as const,
          answer: 'Unsupported question.',
          supportedQuestions: SUPPORTED_QUESTIONS,
          data: null,
          chart: null,
        };
    }
  }
}
