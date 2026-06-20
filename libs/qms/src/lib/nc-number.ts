export function formatNcNumber(year: number, sequence: number): string {
  return `NC-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseNcSequence(ncNumber: string, year: number): number | null {
  const prefix = `NC-${year}-`;
  if (!ncNumber.startsWith(prefix)) {
    return null;
  }
  const seq = parseInt(ncNumber.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : null;
}
