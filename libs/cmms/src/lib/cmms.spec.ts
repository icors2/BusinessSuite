import {
  isCalendarDueSoon,
  isCalendarOverdue,
  isCycleDueSoon,
  isCycleOverdue,
  isMwoDueSoon,
  isMwoOverdue,
  shouldTriggerCalendar,
  shouldTriggerCycle,
} from './triggers';
import { formatMwoNumber, parseMwoSequence } from './mwo-number';

describe('shouldTriggerCycle', () => {
  it('triggers when cumulative cycles cross threshold since last trigger', () => {
    expect(shouldTriggerCycle(99, 0, 100)).toBe(false);
    expect(shouldTriggerCycle(100, 0, 100)).toBe(true);
    expect(shouldTriggerCycle(150, 100, 100)).toBe(false);
    expect(shouldTriggerCycle(200, 100, 100)).toBe(true);
  });

  it('returns false for invalid threshold', () => {
    expect(shouldTriggerCycle(10, 0, 0)).toBe(false);
  });
});

describe('shouldTriggerCalendar', () => {
  it('triggers when interval elapsed since last trigger', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const last = new Date('2026-05-01T12:00:00Z');
    expect(shouldTriggerCalendar(last, 30, now)).toBe(true);
    expect(shouldTriggerCalendar(last, 60, now)).toBe(false);
  });

  it('triggers when never triggered before', () => {
    expect(shouldTriggerCalendar(null, 30)).toBe(true);
  });
});

describe('due-soon and overdue helpers', () => {
  it('detects cycle due soon and overdue', () => {
    expect(isCycleDueSoon(95, 0, 100)).toBe(true);
    expect(isCycleOverdue(100, 0, 100)).toBe(true);
  });

  it('detects calendar due soon and overdue', () => {
    const last = new Date('2026-05-30T12:00:00Z');
    expect(isCalendarDueSoon(last, 30, new Date('2026-06-27T12:00:00Z'))).toBe(
      true,
    );
    expect(isCalendarOverdue(last, 30, new Date('2026-06-30T12:00:00Z'))).toBe(
      true,
    );
  });

  it('detects MWO due soon and overdue by scheduled date', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const scheduled = new Date('2026-06-22T12:00:00Z');
    const past = new Date('2026-06-18T12:00:00Z');
    expect(isMwoDueSoon('OPEN', scheduled, now)).toBe(true);
    expect(isMwoOverdue('OPEN', past, now)).toBe(true);
    expect(isMwoOverdue('COMPLETED', past, now)).toBe(false);
  });
});

describe('MWO numbering', () => {
  it('formats and parses MWO numbers', () => {
    expect(formatMwoNumber(2026, 1)).toBe('MWO-2026-0001');
    expect(parseMwoSequence('MWO-2026-0042', 2026)).toBe(42);
    expect(parseMwoSequence('MWO-2025-0001', 2026)).toBeNull();
  });
});
