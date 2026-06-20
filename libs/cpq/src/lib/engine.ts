/** Costing engine — plate, tube, weldment, purchased parts, assemblies. */
import { FormulaCatalog, DEFAULT_FORMULAS } from './formulas';
import { RateCard } from './rate-card';

export interface CpqMaterialRecord {
  itemNumber: string;
  description: string;
  standardCost: number;
  uom: number;
  uomProcess: number;
  cutSpeedInMin: number;
  pierceTimeSecs: number;
}

export interface CpqCatalogPartRecord {
  itemNumber: string;
  description: string;
  itemType: string;
  standardCost: number;
}

export interface EngineCatalog {
  material(itemNumber: string): CpqMaterialRecord | null;
  part(itemNumber: string): CpqCatalogPartRecord | null;
}

export class InMemoryEngineCatalog implements EngineCatalog {
  private materials = new Map<string, CpqMaterialRecord>();
  private parts = new Map<string, CpqCatalogPartRecord>();

  addMaterial(m: CpqMaterialRecord) {
    this.materials.set(m.itemNumber, m);
  }

  addPart(p: CpqCatalogPartRecord) {
    this.parts.set(p.itemNumber, p);
  }

  material(itemNumber: string): CpqMaterialRecord | null {
    return this.materials.get(itemNumber) ?? null;
  }

  part(itemNumber: string): CpqCatalogPartRecord | null {
    return this.parts.get(itemNumber) ?? null;
  }
}

export interface OpCost {
  process: string;
  minutes: number;
  cost: number;
  detail: string;
}

export interface Hole {
  diameter: number;
  qty: number;
}

export interface Slot {
  length: number;
  width: number;
  qty: number;
}

function laborCost(
  minutes: number,
  rate: number,
  laborMargin: number,
  formulas: FormulaCatalog,
): number {
  return formulas.eval('labor_cost', { minutes, rate, labor_margin: laborMargin });
}

function materialWithMargin(
  raw: number,
  materialMargin: number,
  formulas: FormulaCatalog,
): number {
  return formulas.eval('material_with_margin', { raw, material_margin: materialMargin });
}

export interface PartResult {
  part: FabPart;
  materialCost: number;
  ops: OpCost[];
  partsPerStock: number;
  materialLabel: string;
  laborCost: number;
  unitCost: number;
  qtyInAssembly: number;
  extendedCost: number;
  setups: number;
  toDict(): Record<string, unknown>;
}

export type FabPartKind = 'plate' | 'tube' | 'weldment' | 'purchased';

export interface FabPartBase {
  name: string;
  itemNumber: string;
  qtyInAssembly: number;
  setups: number | null;
  kind: FabPartKind;
}

export interface PlatePartInput extends FabPartBase {
  kind: 'plate';
  material: string;
  length: number;
  width: number;
  holes: Hole[];
  slots: Slot[];
  extraCutIn: number;
  drillFeatures: number;
  tapHoles: number;
  machineFeatures: number;
  pressBends: number;
}

export interface TubePartInput extends FabPartBase {
  kind: 'tube';
  material: string;
  partLength: number;
  cutMethod: 'tube_laser' | 'saw';
  laserFeatures: number;
  sawCuts: number;
  drillFeatures: number;
  tapHoles: number;
  machineFeatures: number;
  pressBends: number;
}

export interface WeldmentInput extends FabPartBase {
  kind: 'weldment';
  components: number;
  weldInches: number;
  length: number;
  height: number;
  depth: number;
  blast: boolean;
  blastHours: number;
  powder: boolean;
}

export interface PurchasedPartInput extends FabPartBase {
  kind: 'purchased';
  unitCost: number;
}

export type FabPart =
  | PlatePartInput
  | TubePartInput
  | WeldmentInput
  | PurchasedPartInput;

function buildPartResult(
  part: FabPart,
  materialCost: number,
  ops: OpCost[],
  partsPerStock = 0,
  materialLabel = 'material',
): PartResult {
  const labor = ops.reduce((sum, o) => sum + o.cost, 0);
  const unit = materialCost + labor;
  const qty = part.qtyInAssembly || 1;
  const setups =
    part.setups != null
      ? part.setups
      : new Set(ops.map((o) => o.process)).size;

  return {
    part,
    materialCost,
    ops,
    partsPerStock,
    materialLabel,
    laborCost: labor,
    unitCost: unit,
    qtyInAssembly: qty,
    extendedCost: unit * qty,
    setups,
    toDict() {
      return {
        name: part.name,
        itemNumber: part.itemNumber,
        kind: part.kind,
        qtyInAssembly: qty,
        materialCost: round4(materialCost),
        laborCost: round4(labor),
        unitCost: round4(unit),
        extendedCost: round4(unit * qty),
        setups,
        partsPerStock: partsPerStock,
        ops: ops.map((o) => ({
          process: o.process,
          minutes: round4(o.minutes),
          cost: round4(o.cost),
          detail: o.detail,
        })),
      };
    },
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function costPlatePart(
  part: PlatePartInput,
  rc: RateCard,
  catalog: EngineCatalog,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): PartResult {
  const mat = part.material ? catalog.material(part.material) : null;
  const ops: OpCost[] = [];
  let materialCost = 0;
  let partsPerSheet = 0;

  if (mat && part.length > 0 && part.width > 0 && mat.uomProcess > 0) {
    const partArea = formulas.eval('plate_part_area', {
      length: part.length,
      width: part.width,
    });
    const sheetCost = formulas.eval('plate_sheet_cost', {
      standard_cost: mat.standardCost,
      uom: mat.uom,
    });
    partsPerSheet = formulas.eval('plate_parts_per_sheet', {
      uom_process: mat.uomProcess,
      part_area: partArea,
    });
    if (partsPerSheet > 0) {
      const raw = formulas.eval('plate_material_raw_nest', {
        sheet_cost: sheetCost,
        parts_per_sheet: partsPerSheet,
      });
      materialCost = materialWithMargin(raw, rc.materialMargin, formulas);
    } else {
      const sheetsPerPart = formulas.eval('plate_sheets_per_part', {
        part_area: partArea,
        uom_process: mat.uomProcess,
      });
      const raw = formulas.eval('plate_material_raw_oversize', {
        sheet_cost: sheetCost,
        sheets_per_part: sheetsPerPart,
      });
      materialCost = materialWithMargin(raw, rc.materialMargin, formulas);
    }
  }

  const perimeter = formulas.eval('plate_perimeter', {
    length: part.length,
    width: part.width,
  });
  const holeCut = part.holes.reduce(
    (sum, h) => sum + h.diameter * Math.PI * h.qty,
    0,
  );
  const slotCut = part.slots.reduce(
    (sum, s) => sum + (s.length + s.width) * 2 * s.qty,
    0,
  );
  const pierces =
    part.holes.reduce((s, h) => s + h.qty, 0) +
    part.slots.reduce((s, sl) => s + sl.qty, 0) +
    1;
  const totalCut = formulas.eval('plate_total_cut', {
    perimeter,
    hole_cut: holeCut,
    slot_cut: slotCut,
    extra_cut_in: part.extraCutIn,
  });

  if (mat && mat.cutSpeedInMin > 0) {
    const laserMin = formulas.eval('plate_laser_minutes', {
      total_cut: totalCut,
      cut_speed_in_min: mat.cutSpeedInMin,
      pierces,
      pierce_time_secs: mat.pierceTimeSecs,
    });
    const laserCost = laborCost(laserMin, rc.rate('laser'), rc.laborMargin, formulas);
    if (laserMin) {
      ops.push({
        process: 'laser',
        minutes: laserMin,
        cost: laserCost,
        detail: `${totalCut.toFixed(1)} in cut, ${pierces} pierces`,
      });
    }
  }

  for (const [process, count] of [
    ['drill', part.drillFeatures],
    ['tap', part.tapHoles],
    ['machine', part.machineFeatures],
    ['press', part.pressBends],
  ] as const) {
    if (count) {
      const minutes = formulas.eval('feature_minutes', {
        count,
        minutes_per_feature: rc.featureMinutes(process),
      });
      const cost = laborCost(minutes, rc.rate(process), rc.laborMargin, formulas);
      ops.push({ process, minutes, cost, detail: `${count} features` });
    }
  }

  return buildPartResult(part, materialCost, ops, partsPerSheet);
}

export function costTubePart(
  part: TubePartInput,
  rc: RateCard,
  catalog: EngineCatalog,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): PartResult {
  const mat = part.material ? catalog.material(part.material) : null;
  const ops: OpCost[] = [];
  let materialCost = 0;
  let partsPerLength = 0;

  if (mat && part.partLength > 0 && mat.uom > 0) {
    const stockLen = mat.uom;
    partsPerLength = formulas.eval('tube_parts_per_length', {
      stock_len: stockLen,
      part_length: part.partLength,
    });
    if (partsPerLength > 0) {
      const raw = formulas.eval('tube_material_raw', {
        stock_len: stockLen,
        standard_cost: mat.standardCost,
        parts_per_length: partsPerLength,
      });
      materialCost = materialWithMargin(raw, rc.materialMargin, formulas);
    }
  }

  if (part.cutMethod === 'saw') {
    if (part.sawCuts) {
      const minutes = formulas.eval('feature_minutes', {
        count: part.sawCuts,
        minutes_per_feature: rc.featureMinutes('saw'),
      });
      const cost = laborCost(minutes, rc.rate('saw'), rc.laborMargin, formulas);
      ops.push({ process: 'saw', minutes, cost, detail: `${part.sawCuts} cuts` });
    }
  } else {
    const tubeLaserBase = formulas.eval('tube_laser_base', {
      part_length: part.partLength,
    });
    const minutes = formulas.eval('tube_laser_minutes', {
      laser_features: part.laserFeatures,
      tube_laser_base: tubeLaserBase,
    });
    const cost = laborCost(minutes, rc.rate('tube_laser'), rc.laborMargin, formulas);
    ops.push({
      process: 'tube_laser',
      minutes,
      cost,
      detail: `${part.laserFeatures} features`,
    });
  }

  for (const [process, count] of [
    ['drill', part.drillFeatures],
    ['tap', part.tapHoles],
    ['machine', part.machineFeatures],
    ['press', part.pressBends],
  ] as const) {
    if (count) {
      const minutes = formulas.eval('feature_minutes', {
        count,
        minutes_per_feature: rc.featureMinutes(process),
      });
      const cost = laborCost(minutes, rc.rate(process), rc.laborMargin, formulas);
      ops.push({ process, minutes, cost, detail: `${count} features` });
    }
  }

  return buildPartResult(part, materialCost, ops, partsPerLength);
}

export function costWeldment(
  part: WeldmentInput,
  rc: RateCard,
  _catalog: EngineCatalog,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): PartResult {
  const ops: OpCost[] = [];
  const dimTotal = part.length + part.height + part.depth;

  const tackMin = formulas.eval('weld_tack_minutes', {
    dim_total: dimTotal,
    components: part.components,
  });
  const weldUnit = formulas.eval('weld_unit', { weld_inches: part.weldInches });
  const weldMin = formulas.eval('weld_minutes', {
    dim_total: dimTotal,
    weld_unit: weldUnit,
  });
  const weldTotalMin = tackMin + weldMin;
  const weldCost = laborCost(weldTotalMin, rc.rate('weld'), rc.laborMargin, formulas);
  if (weldTotalMin) {
    ops.push({
      process: 'weld',
      minutes: weldTotalMin,
      cost: weldCost,
      detail: `${part.components} comps, ${part.weldInches.toFixed(0)} in weld`,
    });
  }

  if (part.blast && part.blastHours) {
    const minutes = formulas.eval('blast_minutes', {
      blast_hours: part.blastHours,
    });
    const cost = laborCost(minutes, rc.rate('blast'), rc.laborMargin, formulas);
    ops.push({
      process: 'blast',
      minutes,
      cost,
      detail: `${part.blastHours.toFixed(2)} hr`,
    });
  }

  if (part.powder) {
    const perLen = formulas.eval('powder_per_len', { length: part.length });
    const perHt = formulas.eval('powder_per_ht', { height: part.height });
    const perDepth = formulas.eval('powder_per_depth', { depth: part.depth });
    const perBar = formulas.eval('powder_per_bar', {
      per_len: perLen,
      per_ht: perHt,
      per_depth: perDepth,
    });
    if (perBar > 0) {
      const runHours = formulas.eval('powder_run_hours', { per_bar: perBar });
      const minutes = formulas.eval('powder_minutes', { run_hours: runHours });
      const cost = laborCost(minutes, rc.rate('powder'), rc.laborMargin, formulas);
      ops.push({
        process: 'powder',
        minutes,
        cost,
        detail: `${perBar}/load bar`,
      });
    }
  }

  return buildPartResult(part, 0, ops);
}

export function costPurchasedPart(
  part: PurchasedPartInput,
  _rc: RateCard,
  catalog: EngineCatalog,
): PartResult {
  let unit = part.unitCost;
  if (!unit && part.itemNumber) {
    const p = catalog.part(part.itemNumber);
    if (p) unit = p.standardCost;
  }
  return buildPartResult(part, unit, [], 0, 'purchased');
}

export function costFabPart(
  part: FabPart,
  rc: RateCard,
  catalog: EngineCatalog,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): PartResult {
  switch (part.kind) {
    case 'plate':
      return costPlatePart(part, rc, catalog, formulas);
    case 'tube':
      return costTubePart(part, rc, catalog, formulas);
    case 'weldment':
      return costWeldment(part, rc, catalog, formulas);
    case 'purchased':
      return costPurchasedPart(part, rc, catalog);
    default:
      throw new Error(`unknown part kind: ${(part as FabPart).kind}`);
  }
}

export interface AssemblyInput {
  name: string;
  itemNumber: string;
  customer: string;
  parts: FabPart[];
}

export interface AssemblyResult {
  assembly: AssemblyInput;
  parts: PartResult[];
  unitCost: number;
  totalSetups: number;
  materialCost: number;
  laborCost: number;
  toDict(): Record<string, unknown>;
}

export function costAssembly(
  assembly: AssemblyInput,
  rc: RateCard,
  catalog: EngineCatalog,
  formulas: FormulaCatalog = DEFAULT_FORMULAS,
): AssemblyResult {
  const parts = assembly.parts.map((p) =>
    costFabPart(p, rc, catalog, formulas),
  );
  const unitCost = parts.reduce((s, p) => s + p.extendedCost, 0);
  const totalSetups = parts.reduce((s, p) => s + p.setups, 0);
  const materialCost = parts.reduce(
    (s, p) => s + p.materialCost * p.qtyInAssembly,
    0,
  );
  const laborCost = parts.reduce(
    (s, p) => s + p.laborCost * p.qtyInAssembly,
    0,
  );

  return {
    assembly,
    parts,
    unitCost,
    totalSetups,
    materialCost,
    laborCost,
    toDict() {
      return {
        name: assembly.name,
        itemNumber: assembly.itemNumber,
        customer: assembly.customer,
        unitCost: round4(unitCost),
        materialCost: round4(materialCost),
        laborCost: round4(laborCost),
        totalSetups,
        parts: parts.map((p) => p.toDict()),
      };
    },
  };
}

export function buildFabPartFromPayload(data: Record<string, unknown>): FabPart {
  const kind = String(data['kind'] ?? 'plate').toLowerCase();
  const common = {
    name: String(data['name'] ?? ''),
    itemNumber: String(data['itemNumber'] ?? data['item_number'] ?? ''),
    qtyInAssembly: numInt(data['qtyInAssembly'] ?? data['qty_in_assembly'], 1),
    setups:
      data['setups'] === null || data['setups'] === undefined || data['setups'] === ''
        ? null
        : numInt(data['setups'], 0),
  };

  if (kind === 'plate') {
    return {
      kind: 'plate',
      material: String(data['material'] ?? ''),
      length: num(data['length']),
      width: num(data['width']),
      holes: Array.isArray(data['holes'])
        ? (data['holes'] as Record<string, unknown>[])
            .filter((h) => num(h['diameter']) > 0)
            .map((h) => ({
              diameter: num(h['diameter']),
              qty: numInt(h['qty'], 1),
            }))
        : [],
      slots: Array.isArray(data['slots'])
        ? (data['slots'] as Record<string, unknown>[])
            .filter((s) => num(s['length']) > 0)
            .map((s) => ({
              length: num(s['length']),
              width: num(s['width']),
              qty: numInt(s['qty'], 1),
            }))
        : [],
      extraCutIn: num(data['extraCutIn'] ?? data['extra_cut_in']),
      drillFeatures: numInt(data['drillFeatures'] ?? data['drill_features']),
      tapHoles: numInt(data['tapHoles'] ?? data['tap_holes']),
      machineFeatures: numInt(data['machineFeatures'] ?? data['machine_features']),
      pressBends: numInt(data['pressBends'] ?? data['press_bends']),
      ...common,
    };
  }

  if (kind === 'tube') {
    return {
      kind: 'tube',
      material: String(data['material'] ?? ''),
      partLength: num(data['partLength'] ?? data['part_length']),
      cutMethod: (data['cutMethod'] ?? data['cut_method'] ?? 'tube_laser') as
        | 'tube_laser'
        | 'saw',
      laserFeatures: numInt(data['laserFeatures'] ?? data['laser_features']),
      sawCuts: numInt(data['sawCuts'] ?? data['saw_cuts']),
      drillFeatures: numInt(data['drillFeatures'] ?? data['drill_features']),
      tapHoles: numInt(data['tapHoles'] ?? data['tap_holes']),
      machineFeatures: numInt(data['machineFeatures'] ?? data['machine_features']),
      pressBends: numInt(data['pressBends'] ?? data['press_bends']),
      ...common,
    };
  }

  if (kind === 'weldment') {
    return {
      kind: 'weldment',
      components: numInt(data['components']),
      weldInches: num(data['weldInches'] ?? data['weld_inches']),
      length: num(data['length']),
      height: num(data['height']),
      depth: num(data['depth']),
      blast: Boolean(data['blast']),
      blastHours: num(data['blastHours'] ?? data['blast_hours']),
      powder: Boolean(data['powder']),
      ...common,
    };
  }

  if (kind === 'purchased' || kind === 'standard' || kind === 'pem') {
    return {
      kind: 'purchased',
      unitCost: num(data['unitCost'] ?? data['unit_cost']),
      ...common,
    };
  }

  throw new Error(`unknown part kind: ${kind}`);
}

function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numInt(value: unknown, fallback = 0): number {
  return Math.round(num(value, fallback));
}
