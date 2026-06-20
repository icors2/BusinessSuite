import {
  computeCycleDuration,
  computeEfficiency,
  canStartOperation,
  allOperationsCompleted,
} from './cycle';
import { encodeCode128Svg, renderPlacardHtml } from './placard';

describe('computeCycleDuration', () => {
  it('computes minutes between start and end', () => {
    const start = new Date('2026-06-19T08:00:00.000Z');
    const end = new Date('2026-06-19T09:30:00.000Z');
    expect(computeCycleDuration(start, end)).toBe(90);
  });
});

describe('computeEfficiency', () => {
  it('returns standard over actual ratio', () => {
    expect(computeEfficiency(60, 30)).toBe(0.5);
  });

  it('returns null when no standard', () => {
    expect(computeEfficiency(60, null)).toBeNull();
  });
});

describe('operation guards', () => {
  it('allows start only from PENDING', () => {
    expect(canStartOperation('PENDING')).toBe(true);
    expect(canStartOperation('IN_PROGRESS')).toBe(false);
    expect(canStartOperation('COMPLETED')).toBe(false);
  });

  it('detects when all operations are completed', () => {
    expect(allOperationsCompleted(['COMPLETED', 'COMPLETED'])).toBe(true);
    expect(allOperationsCompleted(['COMPLETED', 'PENDING'])).toBe(false);
    expect(allOperationsCompleted([])).toBe(false);
  });
});

describe('placard', () => {
  it('renders HTML with WO number and barcode SVG', () => {
    const html = renderPlacardHtml(
      {
        woNumber: 'WO-2026-SEED1',
        productSku: 'SKU-001',
        quantity: 10,
        status: 'IN_PROGRESS',
      },
      [
        {
          sequence: 1,
          name: 'Cut',
          status: 'COMPLETED',
          workstationCode: 'WS-LASER',
        },
      ],
    );

    expect(html).toContain('WO-2026-SEED1');
    expect(html).toContain('<svg');
    expect(html).toContain('Cut');
  });

  it('encodes Code128 SVG for WO number', () => {
    const svg = encodeCode128Svg('WO-2026-001');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
  });
});
