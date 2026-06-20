export function formatPoNumber(year: number, sequence: number): string {
  return `PO-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parsePoSequence(poNumber: string, year: number): number | null {
  const prefix = `PO-${year}-`;
  if (!poNumber.startsWith(prefix)) {
    return null;
  }
  const seq = Number(poNumber.slice(prefix.length));
  return Number.isFinite(seq) ? seq : null;
}
