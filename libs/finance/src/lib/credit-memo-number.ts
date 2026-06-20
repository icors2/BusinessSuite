export function formatCreditMemoNumber(year: number, sequence: number): string {
  return `CM-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseCreditMemoSequence(
  creditMemoNumber: string,
  year: number,
): number | null {
  const prefix = `CM-${year}-`;
  if (!creditMemoNumber.startsWith(prefix)) {
    return null;
  }
  const seq = parseInt(creditMemoNumber.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : null;
}
