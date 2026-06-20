/** Rate card and pricing configuration (FabQuote defaults). */

export const DEFAULT_MINUTES_PER_FEATURE: Record<string, number> = {
  drill: 0.5,
  tap: 0.5,
  machine: 0.5,
  press: 0.5,
  saw: 0.5,
};

export interface RateCardData {
  materialMargin: number;
  laborMargin: number;
  ratesPerMin: Record<string, number>;
  minutesPerFeature: Record<string, number>;
}

export class RateCard {
  materialMargin: number;
  laborMargin: number;
  ratesPerMin: Record<string, number>;
  minutesPerFeature: Record<string, number>;

  constructor(data?: Partial<RateCardData>) {
    this.materialMargin = data?.materialMargin ?? 0.7;
    this.laborMargin = data?.laborMargin ?? 0.7;
    this.ratesPerMin = {
      laser: 2.205,
      tube_laser: 2.1243,
      saw: 1.0965,
      drill: 1.097,
      tap: 1.097,
      machine: 1.0965,
      weld: 1.0425,
      powder: 6.324,
      blast: 1.0,
      press: 0.8288,
      ...(data?.ratesPerMin ?? {}),
    };
    this.minutesPerFeature = {
      ...DEFAULT_MINUTES_PER_FEATURE,
      ...(data?.minutesPerFeature ?? {}),
    };
  }

  rate(process: string): number {
    return Number(this.ratesPerMin[process] ?? 0);
  }

  featureMinutes(process: string): number {
    return Number(this.minutesPerFeature[process] ?? 0.5);
  }

  toDict(): RateCardData {
    return {
      materialMargin: this.materialMargin,
      laborMargin: this.laborMargin,
      ratesPerMin: { ...this.ratesPerMin },
      minutesPerFeature: { ...this.minutesPerFeature },
    };
  }

  static fromDict(raw: Record<string, unknown> | null | undefined): RateCard {
    if (!raw) return new RateCard();
    return new RateCard({
      materialMargin: Number(raw['materialMargin'] ?? raw['material_margin'] ?? 0.7) || 1.0,
      laborMargin: Number(raw['laborMargin'] ?? raw['labor_margin'] ?? 0.7) || 1.0,
      ratesPerMin: (raw['ratesPerMin'] ?? raw['rates_per_min']) as Record<string, number>,
      minutesPerFeature: (raw['minutesPerFeature'] ?? raw['minutes_per_feature']) as Record<string, number>,
    });
  }
}

export interface VolumeBreak {
  minQty: number;
  discountPct: number;
}

export interface PricingConfigData {
  setupBaseCost: number;
  extraMargin: number;
  priceRounding: number;
  quantityBreaks: number[];
  tierDiscounts: Record<string, number>;
  volumeBreaks: VolumeBreak[];
}

export class PricingConfig {
  setupBaseCost: number;
  extraMargin: number;
  priceRounding: number;
  quantityBreaks: number[];
  tierDiscounts: Record<string, number>;
  volumeBreaks: VolumeBreak[];

  constructor(data?: Partial<PricingConfigData>) {
    this.setupBaseCost = data?.setupBaseCost ?? 85.0;
    this.extraMargin = data?.extraMargin ?? 0.0;
    this.priceRounding = data?.priceRounding ?? 0.25;
    this.quantityBreaks = data?.quantityBreaks ?? [1, 2, 3, 5, 10, 25, 50, 100];
    this.tierDiscounts = data?.tierDiscounts ?? {
      standard: 0,
      preferred: 5,
      strategic: 10,
    };
    this.volumeBreaks = data?.volumeBreaks ?? [
      { minQty: 1, discountPct: 0 },
      { minQty: 10, discountPct: 2 },
      { minQty: 25, discountPct: 5 },
      { minQty: 100, discountPct: 10 },
    ];
  }

  toDict(): PricingConfigData {
    return {
      setupBaseCost: this.setupBaseCost,
      extraMargin: this.extraMargin,
      priceRounding: this.priceRounding,
      quantityBreaks: [...this.quantityBreaks],
      tierDiscounts: { ...this.tierDiscounts },
      volumeBreaks: this.volumeBreaks.map((b) => ({ ...b })),
    };
  }

  static fromDict(raw: Record<string, unknown> | null | undefined): PricingConfig {
    if (!raw) return new PricingConfig();
    const breaks = raw['quantityBreaks'] ?? raw['quantity_breaks'];
    const parsedBreaks = Array.isArray(breaks)
      ? [...new Set(breaks.map((b) => Number(b)).filter((b) => b > 0))].sort(
          (a, b) => a - b,
        )
      : undefined;
    return new PricingConfig({
      setupBaseCost: Number(raw['setupBaseCost'] ?? raw['setup_base_cost'] ?? 85),
      extraMargin: Number(raw['extraMargin'] ?? raw['extra_margin'] ?? 0),
      priceRounding: Number(raw['priceRounding'] ?? raw['price_rounding'] ?? 0.25),
      quantityBreaks: parsedBreaks,
      tierDiscounts: raw['tierDiscounts'] as Record<string, number>,
      volumeBreaks: raw['volumeBreaks'] as VolumeBreak[],
    });
  }
}

export const CPQ_SETTING_KEYS = {
  rateCard: 'rate_card',
  pricingConfig: 'pricing_config',
  formulaOverrides: 'formula_overrides',
} as const;
