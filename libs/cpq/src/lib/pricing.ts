/** Quantity-break customer pricing and rule-based product pricing. */
import { AssemblyResult } from './engine';
import { FormulaCatalog, DEFAULT_FORMULAS } from './formulas';
import { PricingConfig } from './rate-card';

export interface QuantityPrice {
  qty: number;
  unitPrice: number;
  extendedPrice: number;
  setupPerUnit: number;
}

export interface QuotePricingResult {
  basePrice: number;
  setupCost: number;
  breaks: QuantityPrice[];
  toDict(): Record<string, unknown>;
}

export function priceBreaks(
  result: AssemblyResult,
  cfg: PricingConfig,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): QuotePricingResult {
  const extraMargin = Math.min(Math.max(cfg.extraMargin, 0), 0.99);
  const basePrice = formulas.eval('pricing_base_price', {
    unit_cost: result.unitCost,
    extra_margin: extraMargin,
  });
  const setupCost = formulas.eval('pricing_setup_cost', {
    setup_base_cost: cfg.setupBaseCost,
    total_setups: result.totalSetups,
  });

  const breaks: QuantityPrice[] = [];
  for (const qty of cfg.quantityBreaks) {
    if (qty <= 0) continue;
    const setupPerUnit = setupCost / qty;
    const unitPrice = formulas.eval('pricing_unit_price', {
      base_price: basePrice,
      setup_cost: setupCost,
      qty,
      price_rounding: cfg.priceRounding,
    });
    breaks.push({
      qty,
      unitPrice,
      extendedPrice: Math.round(unitPrice * qty * 100) / 100,
      setupPerUnit,
    });
  }

  return {
    basePrice,
    setupCost,
    breaks,
    toDict() {
      return {
        basePrice: Math.round(basePrice * 10000) / 10000,
        setupCost: Math.round(setupCost * 100) / 100,
        breaks: breaks.map((b) => ({
          qty: b.qty,
          unitPrice: Math.round(b.unitPrice * 100) / 100,
          extendedPrice: b.extendedPrice,
          setupPerUnit: Math.round(b.setupPerUnit * 10000) / 10000,
        })),
      };
    },
  };
}

/** Unit price at a specific quantity from assembly costing. */
export function unitPriceAtQty(
  assembly: AssemblyResult,
  cfg: PricingConfig,
  qty: number,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): number {
  const table = priceBreaks(assembly, cfg, formulas);
  const match =
    [...table.breaks].reverse().find((b) => b.qty <= qty) ?? table.breaks[0];
  return match?.unitPrice ?? table.basePrice;
}

export interface ProductPriceInput {
  listPrice: number;
  quantity: number;
  priceTier?: string | null;
  manualUnitPrice?: number | null;
  overrideReason?: string | null;
}

export interface ProductPriceResult {
  basePrice: number;
  tierDiscountPct: number;
  volumeDiscountPct: number;
  unitPrice: number;
  discountPct: number;
}

export function priceProductLine(
  input: ProductPriceInput,
  cfg: PricingConfig,
): ProductPriceResult {
  if (input.manualUnitPrice != null && input.overrideReason?.trim()) {
    return {
      basePrice: input.listPrice,
      tierDiscountPct: 0,
      volumeDiscountPct: 0,
      unitPrice: input.manualUnitPrice,
      discountPct: 0,
    };
  }

  const tierKey = (input.priceTier ?? 'standard').toLowerCase();
  const tierDiscountPct = cfg.tierDiscounts[tierKey] ?? 0;

  let volumeDiscountPct = 0;
  for (const br of cfg.volumeBreaks) {
    if (input.quantity >= br.minQty) {
      volumeDiscountPct = br.discountPct;
    }
  }

  const totalDiscountPct = tierDiscountPct + volumeDiscountPct;
  const unitPrice =
    input.listPrice * (1 - totalDiscountPct / 100);

  return {
    basePrice: input.listPrice,
    tierDiscountPct,
    volumeDiscountPct,
    unitPrice: Math.round(unitPrice * 10000) / 10000,
    discountPct: totalDiscountPct,
  };
}

export function lineTotal(
  unitPrice: number,
  quantity: number,
  discountPct = 0,
): number {
  const gross = unitPrice * quantity;
  const discount = gross * (discountPct / 100);
  return Math.round((gross - discount) * 100) / 100;
}
