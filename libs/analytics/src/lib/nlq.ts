export type NlqIntent =
  | 'scrapRate'
  | 'bottleneck'
  | 'inventoryForecast'
  | 'eventVolume'
  | 'returnsCount'
  | 'unknown';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface NlqParams {
  sku?: string;
  topic?: string;
  range?: DateRange;
}

export interface NlqParseResult {
  intent: NlqIntent;
  params: NlqParams;
}

export const SUPPORTED_QUESTIONS = [
  'What was our scrap rate last month?',
  'What is the scrap rate by product this month?',
  'Where are the production bottlenecks?',
  'Show inventory forecast',
  'What is the inventory forecast for SKU-001?',
  'How many returns were requested last month?',
  'Show event volume for the last 30 days',
];

export function parseTimeRange(text: string, now = new Date()): DateRange | undefined {
  const lower = text.toLowerCase();

  const lastDaysMatch = lower.match(/last\s+(\d+)\s+days?/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1]!, 10);
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - days);
    from.setUTCHours(0, 0, 0, 0);
    return { from, to: now };
  }

  if (lower.includes('last month')) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return { from, to };
  }

  if (lower.includes('this month')) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { from, to: now };
  }

  return undefined;
}

export function parseQuestion(text: string, now = new Date()): NlqParseResult {
  const lower = text.toLowerCase().trim();
  const range = parseTimeRange(lower, now);

  const skuMatch = lower.match(/sku[-\s]?(\d+)/i);
  const normalizedSku = skuMatch
    ? `SKU-${skuMatch[1]!.padStart(3, '0')}`
    : undefined;

  if (lower.includes('scrap')) {
    return { intent: 'scrapRate', params: { range, sku: normalizedSku } };
  }

  if (lower.includes('bottleneck') || lower.includes('wip pileup') || lower.includes('where is work accumulating')) {
    return { intent: 'bottleneck', params: {} };
  }

  if (lower.includes('forecast') || lower.includes('depletion') || lower.includes('reorder')) {
    return { intent: 'inventoryForecast', params: { sku: normalizedSku } };
  }

  if (lower.includes('return') || lower.includes('rma')) {
    return { intent: 'returnsCount', params: { range } };
  }

  if (lower.includes('event volume') || lower.includes('events')) {
    return { intent: 'eventVolume', params: { range } };
  }

  return { intent: 'unknown', params: {} };
}

export function computeScrapRate(scrapped: number, completed: number): number {
  const total = scrapped + completed;
  if (total <= 0) return 0;
  return scrapped / total;
}
