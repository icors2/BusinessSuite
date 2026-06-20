import { Decimal } from '@prisma/client/runtime/library';

export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

export function available(onHand: Decimal, allocated: Decimal): Decimal {
  return onHand.minus(allocated);
}

export function quantityRow(onHand: Decimal, allocated: Decimal) {
  const avail = available(onHand, allocated);
  return {
    onHand: onHand.toNumber(),
    allocated: allocated.toNumber(),
    available: avail.toNumber(),
  };
}
