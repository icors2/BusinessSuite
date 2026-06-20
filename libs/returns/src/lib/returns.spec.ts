import {
  isWithinReturnWindow,
  maxReturnableQty,
} from './return-window';
import { formatRmaNumber, parseRmaSequence } from './rma-number';

describe('return window', () => {
  it('allows returns within the configured window', () => {
    const shippedAt = new Date('2026-06-01T12:00:00Z');
    const now = new Date('2026-06-20T12:00:00Z');
    expect(isWithinReturnWindow(shippedAt, now, 30)).toBe(true);
  });

  it('rejects returns outside the window', () => {
    const shippedAt = new Date('2026-05-01T12:00:00Z');
    const now = new Date('2026-06-20T12:00:00Z');
    expect(isWithinReturnWindow(shippedAt, now, 30)).toBe(false);
  });
});

describe('maxReturnableQty', () => {
  it('subtracts already returned quantity from shipped', () => {
    expect(maxReturnableQty(10, 3)).toBe(7);
    expect(maxReturnableQty(5, 5)).toBe(0);
  });
});

describe('RMA numbering', () => {
  it('formats and parses RMA numbers', () => {
    expect(formatRmaNumber(2026, 1)).toBe('RMA-2026-0001');
    expect(parseRmaSequence('RMA-2026-0042', 2026)).toBe(42);
    expect(parseRmaSequence('RMA-2025-0001', 2026)).toBeNull();
  });
});
