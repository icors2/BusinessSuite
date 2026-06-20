import { InspectionCriterionType, InspectionResult } from '@prisma/client';

export interface CriterionSpec {
  type: InspectionCriterionType;
  expectedMin?: number | null;
  expectedMax?: number | null;
}

export interface CriterionInput {
  passed?: boolean | null;
  measuredValue?: number | null;
}

export function evaluateCriterion(
  spec: CriterionSpec,
  input: CriterionInput,
): boolean {
  if (spec.type === 'PASS_FAIL') {
    return input.passed === true;
  }

  const value = input.measuredValue;
  if (value == null || Number.isNaN(value)) {
    return false;
  }

  if (spec.expectedMin != null && value < spec.expectedMin) {
    return false;
  }
  if (spec.expectedMax != null && value > spec.expectedMax) {
    return false;
  }
  return true;
}

export function deriveInspectionResult(
  criterionPasses: boolean[],
): InspectionResult {
  if (criterionPasses.length === 0) {
    return 'FAIL';
  }
  return criterionPasses.every(Boolean) ? 'PASS' : 'FAIL';
}

export function shouldApplyHold(severity: string): boolean {
  return severity === 'HOLD';
}
