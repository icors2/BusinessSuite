export function formatMwoNumber(year: number, sequence: number): string {
  return `MWO-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseMwoSequence(mwoNumber: string, year: number): number | null {
  const prefix = `MWO-${year}-`;
  if (!mwoNumber.startsWith(prefix)) {
    return null;
  }
  const seq = parseInt(mwoNumber.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : null;
}
