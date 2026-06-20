const EMP_PREFIX = 'EMP-';

export function formatEmployeeNumber(sequence: number): string {
  return `${EMP_PREFIX}${String(sequence).padStart(4, '0')}`;
}

export function parseEmployeeSequence(employeeNumber: string): number | null {
  if (!employeeNumber.startsWith(EMP_PREFIX)) {
    return null;
  }
  const seq = Number(employeeNumber.slice(EMP_PREFIX.length));
  return Number.isFinite(seq) ? seq : null;
}

export function nextEmployeeNumber(existingNumbers: string[]): string {
  let maxSeq = 0;
  for (const number of existingNumbers) {
    const seq = parseEmployeeSequence(number);
    if (seq != null && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return formatEmployeeNumber(maxSeq + 1);
}
