import {
  avgDailyDemand,
  projectDepletion,
  recommendedReorder,
} from './forecasting';
import { scoreBottlenecks } from './bottleneck';
import {
  computeScrapRate,
  parseQuestion,
  parseTimeRange,
} from './nlq';

describe('NLQ parser', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('maps scrap rate last month', () => {
    const result = parseQuestion('what was our scrap rate last month', now);
    expect(result.intent).toBe('scrapRate');
    expect(result.params.range).toBeDefined();
  });

  it('maps bottleneck questions', () => {
    expect(parseQuestion('where are the bottlenecks').intent).toBe('bottleneck');
  });

  it('maps inventory forecast with SKU', () => {
    const result = parseQuestion('inventory forecast for SKU-001', now);
    expect(result.intent).toBe('inventoryForecast');
    expect(result.params.sku).toBe('SKU-001');
  });

  it('parses last N days range', () => {
    const range = parseTimeRange('show events for the last 7 days', now);
    expect(range).toBeDefined();
    const diffDays = Math.round(
      (now.getTime() - range!.from.getTime()) / (86400000),
    );
    expect(diffDays).toBeGreaterThanOrEqual(7);
    expect(diffDays).toBeLessThanOrEqual(8);
  });
});

describe('forecasting', () => {
  const asOf = new Date('2026-06-01T00:00:00.000Z');

  it('computes avg daily demand', () => {
    expect(avgDailyDemand(30, 30)).toBe(1);
    expect(avgDailyDemand(0, 30)).toBe(0);
  });

  it('projects depletion and reorder dates', () => {
    const depletion = projectDepletion(10, 2, asOf);
    expect(depletion?.toISOString().slice(0, 10)).toBe('2026-06-06');
    const reorder = recommendedReorder(depletion, 2);
    expect(reorder?.toISOString().slice(0, 10)).toBe('2026-06-04');
  });
});

describe('bottleneck scoring', () => {
  it('flags disproportionate WIP', () => {
    const results = scoreBottlenecks([
      { workstationId: '1', workstationCode: 'A', workstationName: 'A', wip: 1, avgCycleMinutes: 5 },
      { workstationId: '2', workstationCode: 'B', workstationName: 'B', wip: 10, avgCycleMinutes: 8 },
    ]);
    expect(results[0]!.workstationCode).toBe('B');
    expect(results[0]!.isBottleneck).toBe(true);
  });
});

describe('scrap rate math', () => {
  it('computes rate as scrapped / total', () => {
    expect(computeScrapRate(2, 8)).toBe(0.2);
    expect(computeScrapRate(0, 0)).toBe(0);
  });
});
