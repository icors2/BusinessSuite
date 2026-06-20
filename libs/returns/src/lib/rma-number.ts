export function formatRmaNumber(year: number, sequence: number): string {
  return `RMA-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseRmaSequence(rmaNumber: string, year: number): number | null {
  const prefix = `RMA-${year}-`;
  if (!rmaNumber.startsWith(prefix)) {
    return null;
  }
  const seq = parseInt(rmaNumber.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : null;
}
