import { QuoteStatus } from '@prisma/client';
import {
  costPlatePart,
  costTubePart,
  costWeldment,
  InMemoryEngineCatalog,
  PlatePartInput,
  PurchasedPartInput,
  TubePartInput,
  WeldmentInput,
  AssemblyInput,
  costAssembly,
} from './engine';
import { FormulaCatalog, validateExpression, FormulaError } from './formulas';
import { priceBreaks, priceProductLine } from './pricing';
import { PricingConfig, RateCard } from './rate-card';
import { QUOTE_TRANSITIONS } from './quote.service';

const FIXTURE_CATALOG = new InMemoryEngineCatalog();
FIXTURE_CATALOG.addMaterial({
  itemNumber: 'S-P0063-3003',
  description: 'Plate 1/4 3003',
  standardCost: 2.5,
  uom: 1,
  uomProcess: 4018,
  cutSpeedInMin: 120,
  pierceTimeSecs: 2,
});
FIXTURE_CATALOG.addMaterial({
  itemNumber: 'S-S11GA-A1011',
  description: 'Sheet 11ga',
  standardCost: 3.0,
  uom: 1,
  uomProcess: 4018,
  cutSpeedInMin: 100,
  pierceTimeSecs: 2,
});

describe('tube laser workbook parity', () => {
  it('matches confirmed cell Z19 = 0.7586785714', () => {
    const rc = new RateCard();
    const part: TubePartInput = {
      kind: 'tube',
      name: '',
      itemNumber: '',
      qtyInAssembly: 1,
      setups: null,
      material: '',
      partLength: 0,
      cutMethod: 'tube_laser',
      laserFeatures: 0,
      sawCuts: 0,
      drillFeatures: 0,
      tapHoles: 0,
      machineFeatures: 0,
      pressBends: 0,
    };
    const res = costTubePart(part, rc, FIXTURE_CATALOG);
    const laser = res.ops.find((o) => o.process === 'tube_laser');
    expect(laser).toBeDefined();
    expect(laser!.minutes).toBeCloseTo(0.25, 6);
    expect(laser!.cost).toBeCloseTo(0.7586785714, 6);
  });
});

describe('powder workbook parity', () => {
  it('matches confirmed cell AT24 = 0.28232142857', () => {
    const rc = new RateCard();
    const part: WeldmentInput = {
      kind: 'weldment',
      name: '',
      itemNumber: '',
      qtyInAssembly: 1,
      setups: null,
      components: 0,
      weldInches: 0,
      length: 0,
      height: 0,
      depth: 0,
      blast: false,
      blastHours: 0,
      powder: true,
    };
    const res = costWeldment(part, rc, FIXTURE_CATALOG);
    const powder = res.ops.find((o) => o.process === 'powder');
    expect(powder).toBeDefined();
    expect(powder!.cost).toBeCloseTo(0.28232142857, 6);
  });
});

describe('plate part end-to-end', () => {
  it('computes material, laser, and drill', () => {
    const rc = new RateCard();
    const mat = FIXTURE_CATALOG.material('S-P0063-3003')!;
    const part: PlatePartInput = {
      kind: 'plate',
      name: '',
      itemNumber: '',
      qtyInAssembly: 1,
      setups: null,
      material: 'S-P0063-3003',
      length: 10,
      width: 5,
      holes: [{ diameter: 1, qty: 2 }],
      slots: [],
      extraCutIn: 0,
      drillFeatures: 3,
      tapHoles: 0,
      machineFeatures: 0,
      pressBends: 0,
    };
    const res = costPlatePart(part, rc, FIXTURE_CATALOG);
    const partsPerSheet = Math.floor(mat.uomProcess / (10 * 5));
    const expMaterial =
      (mat.standardCost * mat.uom) / partsPerSheet / rc.materialMargin;
    expect(res.materialCost).toBeCloseTo(expMaterial, 6);

    const totalCut = (10 + 5) * 2 + 1 * Math.PI * 2;
    const pierces = 3;
    const laserMin = totalCut / mat.cutSpeedInMin + pierces * (mat.pierceTimeSecs / 60);
    const expLaser = (laserMin * rc.rate('laser')) / rc.laborMargin;
    const laser = res.ops.find((o) => o.process === 'laser');
    expect(laser!.cost).toBeCloseTo(expLaser, 6);

    const drill = res.ops.find((o) => o.process === 'drill');
    expect(drill!.cost).toBeCloseTo(
      (3 * 0.5 * rc.rate('drill')) / rc.laborMargin,
      6,
    );
  });

  it('charges whole sheets for oversize parts', () => {
    const rc = new RateCard();
    const mat = FIXTURE_CATALOG.material('S-S11GA-A1011')!;
    const part: PlatePartInput = {
      kind: 'plate',
      name: '',
      itemNumber: '',
      qtyInAssembly: 1,
      setups: null,
      material: 'S-S11GA-A1011',
      length: 96,
      width: 48,
      holes: [],
      slots: [],
      extraCutIn: 0,
      drillFeatures: 0,
      tapHoles: 0,
      machineFeatures: 0,
      pressBends: 0,
    };
    const res = costPlatePart(part, rc, FIXTURE_CATALOG);
    const sheets = Math.ceil((96 * 48) / mat.uomProcess);
    const expMaterial =
      (mat.standardCost * mat.uom) * sheets / rc.materialMargin;
    expect(res.materialCost).toBeCloseTo(expMaterial, 6);
  });
});

describe('quantity-break pricing', () => {
  it('amortizes setup and rounds to 0.25', () => {
    const rc = new RateCard();
    const asm: AssemblyInput = {
      name: '',
      itemNumber: '',
      customer: '',
      parts: [
        {
          kind: 'purchased',
          name: '',
          itemNumber: '',
          qtyInAssembly: 1,
          setups: 1,
          unitCost: 10,
        } as PurchasedPartInput,
      ],
    };
    const result = costAssembly(asm, rc, FIXTURE_CATALOG);
    const cfg = new PricingConfig({
      setupBaseCost: 85,
      extraMargin: 0,
      priceRounding: 0.25,
      quantityBreaks: [1, 10],
    });
    const quote = priceBreaks(result, cfg);
    expect(quote.setupCost).toBeCloseTo(85, 6);
    expect(quote.breaks[0].unitPrice).toBeCloseTo(95.0, 2);
    expect(quote.breaks[1].unitPrice).toBeCloseTo(18.5, 2);
  });

  it('applies extra margin', () => {
    const rc = new RateCard();
    const asm: AssemblyInput = {
      name: '',
      itemNumber: '',
      customer: '',
      parts: [
        {
          kind: 'purchased',
          name: '',
          itemNumber: '',
          qtyInAssembly: 1,
          setups: 0,
          unitCost: 10,
        } as PurchasedPartInput,
      ],
    };
    const result = costAssembly(asm, rc, FIXTURE_CATALOG);
    const cfg = new PricingConfig({
      setupBaseCost: 0,
      extraMargin: 0.5,
      priceRounding: 0.01,
      quantityBreaks: [1],
    });
    const quote = priceBreaks(result, cfg);
    expect(quote.breaks[0].unitPrice).toBeCloseTo(20.0, 2);
  });
});

describe('formula evaluator', () => {
  it('evaluates ternary expressions', () => {
    expect(
      validateExpression('part_length < 15 ? 15 : part_length', {
        part_length: 10,
      }),
    ).toBe(15);
    expect(
      validateExpression('part_length < 15 ? 15 : part_length', {
        part_length: 20,
      }),
    ).toBe(20);
  });

  it('rejects disallowed identifiers', () => {
    expect(() =>
      validateExpression('import os', {}),
    ).toThrow(FormulaError);
  });

  it('applies formula overrides', () => {
    const catalog = new FormulaCatalog({
      feature_minutes: 'count * minutes_per_feature * 2',
    });
    expect(
      catalog.eval('feature_minutes', {
        count: 3,
        minutes_per_feature: 0.5,
      }),
    ).toBe(3);
  });
});

describe('rule-based product pricing', () => {
  it('applies tier and volume discounts', () => {
    const cfg = new PricingConfig({
      tierDiscounts: { standard: 0, preferred: 5, strategic: 10 },
      volumeBreaks: [
        { minQty: 1, discountPct: 0 },
        { minQty: 10, discountPct: 2 },
      ],
    });
    const result = priceProductLine(
      { listPrice: 100, quantity: 10, priceTier: 'preferred' },
      cfg,
    );
    expect(result.unitPrice).toBeCloseTo(93, 2);
  });

  it('honors manual override with reason', () => {
    const cfg = new PricingConfig();
    const result = priceProductLine(
      {
        listPrice: 100,
        quantity: 1,
        manualUnitPrice: 80,
        overrideReason: 'strategic deal',
      },
      cfg,
    );
    expect(result.unitPrice).toBe(80);
  });
});

describe('quote status transitions', () => {
  it('allows draft -> sent only', () => {
    expect(QUOTE_TRANSITIONS[QuoteStatus.DRAFT].send).toBe(QuoteStatus.SENT);
    expect(QUOTE_TRANSITIONS[QuoteStatus.DRAFT].accept).toBeUndefined();
  });

  it('terminal states have no transitions', () => {
    expect(Object.keys(QUOTE_TRANSITIONS[QuoteStatus.ACCEPTED])).toHaveLength(0);
    expect(Object.keys(QUOTE_TRANSITIONS[QuoteStatus.REJECTED])).toHaveLength(0);
    expect(Object.keys(QUOTE_TRANSITIONS[QuoteStatus.EXPIRED])).toHaveLength(0);
  });
});
