import { Decimal } from '@prisma/client/runtime/library';

type DecimalLike = { toNumber(): number };

export function toNumber(value: Decimal | number | DecimalLike): number {
  if (typeof value === 'number') {
    return value;
  }
  return value.toNumber();
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumDebits(
  lines: { debit: Decimal | number | DecimalLike }[],
): number {
  return roundMoney(lines.reduce((sum, l) => sum + toNumber(l.debit), 0));
}

export function sumCredits(
  lines: { credit: Decimal | number | DecimalLike }[],
): number {
  return roundMoney(lines.reduce((sum, l) => sum + toNumber(l.credit), 0));
}

export function lineAmount(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export async function nextEntryNumber(
  prisma: { journalEntry: { count: () => Promise<number> } },
): Promise<string> {
  const count = await prisma.journalEntry.count();
  return `JE-${String(count + 1).padStart(6, '0')}`;
}
