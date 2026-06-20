import {
  deriveInspectionResult,
  evaluateCriterion,
  shouldApplyHold,
} from './evaluation';
import { formatNcNumber, parseNcSequence } from './nc-number';

describe('evaluateCriterion', () => {
  it('passes PASS_FAIL when passed is true', () => {
    expect(
      evaluateCriterion({ type: 'PASS_FAIL' }, { passed: true }),
    ).toBe(true);
    expect(
      evaluateCriterion({ type: 'PASS_FAIL' }, { passed: false }),
    ).toBe(false);
  });

  it('evaluates MEASUREMENT against min/max', () => {
    expect(
      evaluateCriterion(
        { type: 'MEASUREMENT', expectedMin: 10, expectedMax: 20 },
        { measuredValue: 15 },
      ),
    ).toBe(true);
    expect(
      evaluateCriterion(
        { type: 'MEASUREMENT', expectedMin: 10, expectedMax: 20 },
        { measuredValue: 9 },
      ),
    ).toBe(false);
    expect(
      evaluateCriterion(
        { type: 'MEASUREMENT', expectedMin: 10, expectedMax: 20 },
        { measuredValue: 21 },
      ),
    ).toBe(false);
  });
});

describe('deriveInspectionResult', () => {
  it('returns PASS when all criteria pass', () => {
    expect(deriveInspectionResult([true, true])).toBe('PASS');
  });

  it('returns FAIL when any criterion fails', () => {
    expect(deriveInspectionResult([true, false])).toBe('FAIL');
  });
});

describe('NC numbering', () => {
  it('formats and parses NC numbers', () => {
    expect(formatNcNumber(2026, 1)).toBe('NC-2026-0001');
    expect(parseNcSequence('NC-2026-0042', 2026)).toBe(42);
    expect(parseNcSequence('NC-2025-0001', 2026)).toBeNull();
  });
});

describe('shouldApplyHold', () => {
  it('applies hold only for HOLD severity', () => {
    expect(shouldApplyHold('HOLD')).toBe(true);
    expect(shouldApplyHold('MINOR')).toBe(false);
    expect(shouldApplyHold('MAJOR')).toBe(false);
  });
});
