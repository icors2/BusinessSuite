/** Editable costing/pricing formulas with a safe expression evaluator. */
export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

export interface FormulaMeta {
  label: string;
  category: string;
  description: string;
  expression: string;
  variables: string[];
  sample: Record<string, number>;
}

export const FORMULA_DEFAULTS: Record<string, FormulaMeta> = {
  labor_cost: {
    label: 'Labor cost (margined)',
    category: 'General',
    description: 'Cost for a timed operation after labor margin.',
    expression: '(minutes * rate) / labor_margin',
    variables: ['minutes', 'rate', 'labor_margin'],
    sample: { minutes: 10.0, rate: 2.2, labor_margin: 0.7 },
  },
  material_with_margin: {
    label: 'Material cost (margined)',
    category: 'General',
    description: 'Raw material cost after material margin.',
    expression: 'raw / material_margin',
    variables: ['raw', 'material_margin'],
    sample: { raw: 100.0, material_margin: 0.7 },
  },
  feature_minutes: {
    label: 'Feature minutes',
    category: 'General',
    description: 'Minutes for drill, tap, machine, press, or saw features.',
    expression: 'count * minutes_per_feature',
    variables: ['count', 'minutes_per_feature'],
    sample: { count: 4, minutes_per_feature: 0.5 },
  },
  plate_part_area: {
    label: 'Part area',
    category: 'Plate',
    description: 'Rectangular plate area in square inches.',
    expression: 'length * width',
    variables: ['length', 'width'],
    sample: { length: 12.0, width: 6.0 },
  },
  plate_sheet_cost: {
    label: 'Sheet cost',
    category: 'Plate',
    description: 'Cost of one sheet from catalog standard cost and UOM.',
    expression: 'standard_cost * uom',
    variables: ['standard_cost', 'uom'],
    sample: { standard_cost: 2.5, uom: 1.0 },
  },
  plate_parts_per_sheet: {
    label: 'Parts per sheet',
    category: 'Plate',
    description: 'How many parts nest on one sheet by area.',
    expression: 'floor(uom_process / part_area)',
    variables: ['uom_process', 'part_area'],
    sample: { uom_process: 4018.0, part_area: 72.0 },
  },
  plate_sheets_per_part: {
    label: 'Sheets per part (oversize)',
    category: 'Plate',
    description: 'Sheets required when part area exceeds one sheet.',
    expression: 'ceil(part_area / uom_process)',
    variables: ['part_area', 'uom_process'],
    sample: { part_area: 4608.0, uom_process: 4018.0 },
  },
  plate_material_raw_nest: {
    label: 'Raw material (nested)',
    category: 'Plate',
    description: 'Material cost per part when nesting on a sheet.',
    expression: 'sheet_cost / parts_per_sheet',
    variables: ['sheet_cost', 'parts_per_sheet'],
    sample: { sheet_cost: 125.0, parts_per_sheet: 55.0 },
  },
  plate_material_raw_oversize: {
    label: 'Raw material (oversize)',
    category: 'Plate',
    description: 'Material cost per part when part exceeds sheet area.',
    expression: 'sheet_cost * sheets_per_part',
    variables: ['sheet_cost', 'sheets_per_part'],
    sample: { sheet_cost: 125.0, sheets_per_part: 2.0 },
  },
  plate_perimeter: {
    label: 'Perimeter cut',
    category: 'Plate',
    description: 'Outer perimeter cutting length in inches.',
    expression: '(length + width) * 2',
    variables: ['length', 'width'],
    sample: { length: 12.0, width: 6.0 },
  },
  plate_total_cut: {
    label: 'Total cut length',
    category: 'Plate',
    description: 'Perimeter plus holes, slots, and extra cut.',
    expression: 'perimeter + hole_cut + slot_cut + extra_cut_in',
    variables: ['perimeter', 'hole_cut', 'slot_cut', 'extra_cut_in'],
    sample: { perimeter: 36.0, hole_cut: 6.28, slot_cut: 0.0, extra_cut_in: 0.0 },
  },
  plate_laser_minutes: {
    label: 'Laser minutes',
    category: 'Plate',
    description: 'Laser run time from cut length, speed, and pierces.',
    expression:
      'total_cut / cut_speed_in_min + pierces * (pierce_time_secs / 60)',
    variables: ['total_cut', 'cut_speed_in_min', 'pierces', 'pierce_time_secs'],
    sample: {
      total_cut: 42.28,
      cut_speed_in_min: 120.0,
      pierces: 3,
      pierce_time_secs: 2.0,
    },
  },
  tube_parts_per_length: {
    label: 'Parts per stock length',
    category: 'Tube',
    description: 'How many tube parts fit in one stock length.',
    expression: 'floor((stock_len - 8) / (part_length + 0.125))',
    variables: ['stock_len', 'part_length'],
    sample: { stock_len: 240.0, part_length: 48.0 },
  },
  tube_material_raw: {
    label: 'Tube raw material',
    category: 'Tube',
    description: 'Material cost per tube part from stock length.',
    expression: '((stock_len / 12) * standard_cost) / parts_per_length',
    variables: ['stock_len', 'standard_cost', 'parts_per_length'],
    sample: { stock_len: 240.0, standard_cost: 3.5, parts_per_length: 4.0 },
  },
  tube_laser_base: {
    label: 'Tube laser base minutes',
    category: 'Tube',
    description: 'Base term for tube laser time (short parts use 15 min).',
    expression: 'part_length < 15 ? 15 : part_length',
    variables: ['part_length'],
    sample: { part_length: 10.0 },
  },
  tube_laser_minutes: {
    label: 'Tube laser minutes',
    category: 'Tube',
    description: 'Tube laser run time from features and base.',
    expression: '((laser_features * 2.5) + tube_laser_base) / 60',
    variables: ['laser_features', 'tube_laser_base'],
    sample: { laser_features: 2, tube_laser_base: 15.0 },
  },
  weld_tack_minutes: {
    label: 'Weld tack minutes',
    category: 'Weldment',
    description: 'Tack-weld time from overall dimensions and components.',
    expression: '(dim_total / 24) * (components * 1.75)',
    variables: ['dim_total', 'components'],
    sample: { dim_total: 48.0, components: 3 },
  },
  weld_unit: {
    label: 'Weld unit factor',
    category: 'Weldment',
    description: 'Scaled weld length factor (Excel ROUNDUP to 0.1).',
    expression: 'round_up_1(weld_inches / 27) * 3 * 0.75',
    variables: ['weld_inches'],
    sample: { weld_inches: 54.0 },
  },
  weld_minutes: {
    label: 'Weld minutes',
    category: 'Weldment',
    description: 'Weld run time from dimensions and weld unit.',
    expression: '(dim_total / 24) * weld_unit',
    variables: ['dim_total', 'weld_unit'],
    sample: { dim_total: 48.0, weld_unit: 6.0 },
  },
  blast_minutes: {
    label: 'Blast minutes',
    category: 'Weldment',
    description: 'Blast operation minutes from quoted hours.',
    expression: 'blast_hours * 60',
    variables: ['blast_hours'],
    sample: { blast_hours: 0.5 },
  },
  powder_per_len: {
    label: 'Powder parts per length',
    category: 'Weldment',
    description: 'Parts that fit along the load bar by length.',
    expression: 'floor(144 / (length + 6))',
    variables: ['length'],
    sample: { length: 24.0 },
  },
  powder_per_ht: {
    label: 'Powder parts per height',
    category: 'Weldment',
    description: 'Parts that fit across the load bar by height.',
    expression: 'floor(64 / (height + 6))',
    variables: ['height'],
    sample: { height: 12.0 },
  },
  powder_per_depth: {
    label: 'Powder depth factor',
    category: 'Weldment',
    description: 'Depth nesting factor (2 if shallow, else 1).',
    expression: 'depth < 6.1 ? 2 : 1',
    variables: ['depth'],
    sample: { depth: 4.0 },
  },
  powder_per_bar: {
    label: 'Powder parts per bar',
    category: 'Weldment',
    description: 'Total parts per powder load bar.',
    expression: 'per_len * per_ht * per_depth',
    variables: ['per_len', 'per_ht', 'per_depth'],
    sample: { per_len: 4.0, per_ht: 3.0, per_depth: 2.0 },
  },
  powder_run_hours: {
    label: 'Powder run hours',
    category: 'Weldment',
    description: 'Powder coat run time per part in hours.',
    expression: '(15 / 60) / per_bar',
    variables: ['per_bar'],
    sample: { per_bar: 24.0 },
  },
  powder_minutes: {
    label: 'Powder minutes',
    category: 'Weldment',
    description: 'Powder coat minutes per part.',
    expression: 'run_hours * 60',
    variables: ['run_hours'],
    sample: { run_hours: 0.041667 },
  },
  pricing_base_price: {
    label: 'Customer base price',
    category: 'Pricing',
    description: 'Unit price before setup amortization.',
    expression: 'unit_cost / (1 - extra_margin)',
    variables: ['unit_cost', 'extra_margin'],
    sample: { unit_cost: 100.0, extra_margin: 0.1 },
  },
  pricing_setup_cost: {
    label: 'Total setup cost',
    category: 'Pricing',
    description: 'One-time setup charge for all setups.',
    expression: 'setup_base_cost * total_setups',
    variables: ['setup_base_cost', 'total_setups'],
    sample: { setup_base_cost: 85.0, total_setups: 3 },
  },
  pricing_unit_price: {
    label: 'Customer unit price',
    category: 'Pricing',
    description: 'Rounded unit price at a quantity break.',
    expression: 'round_up(base_price + setup_cost / qty, price_rounding)',
    variables: ['base_price', 'setup_cost', 'qty', 'price_rounding'],
    sample: {
      base_price: 111.11,
      setup_cost: 255.0,
      qty: 10,
      price_rounding: 0.25,
    },
  },
};

const ALLOWED_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  round_up: (value: number, increment: number) =>
    increment <= 0 ? value : Math.ceil(value / increment) * increment,
  round_up_1: (value: number) =>
    value >= 0
      ? Math.ceil(value * 10) / 10.0
      : -Math.ceil(-value * 10) / 10.0,
};

const ALLOWED_CONSTANTS: Record<string, number> = { pi: Math.PI };

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'question' }
  | { type: 'colon' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = ch;
      i++;
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if (ch === '?') {
      tokens.push({ type: 'question' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' });
      i++;
      continue;
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ type: 'op', value: '**' });
      i += 2;
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (['<=', '>=', '==', '!='].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if ('<>'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new FormulaError(`unexpected character: ${ch}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly variables: Record<string, number>,
    private readonly allowedNames: Set<string>,
  ) {}

  parse(): number {
    const val = this.parseTernary();
    if (this.pos < this.tokens.length) {
      throw new FormulaError('unexpected trailing tokens');
    }
    return val;
  }

  private parseTernary(): number {
    let val = this.parseComparison();
    if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'question') {
      this.pos++;
      const thenVal = this.parseTernary();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'colon') {
        throw new FormulaError('expected : in ternary');
      }
      this.pos++;
      const elseVal = this.parseTernary();
      return val ? thenVal : elseVal;
    }
    return val;
  }

  private parseComparison(): number {
    let left = this.parseAddSub();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type !== 'op' || !['<', '<=', '>', '>=', '==', '!='].includes(tok.value)) {
        break;
      }
      this.pos++;
      const right = this.parseAddSub();
      switch (tok.value) {
        case '<':
          left = left < right ? 1 : 0;
          break;
        case '<=':
          left = left <= right ? 1 : 0;
          break;
        case '>':
          left = left > right ? 1 : 0;
          break;
        case '>=':
          left = left >= right ? 1 : 0;
          break;
        case '==':
          left = left === right ? 1 : 0;
          break;
        case '!=':
          left = left !== right ? 1 : 0;
          break;
      }
    }
    return left;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type !== 'op' || (tok.value !== '+' && tok.value !== '-')) {
        break;
      }
      this.pos++;
      const right = this.parseMulDiv();
      left = tok.value === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type !== 'op' || !['*', '/', '**'].includes(tok.value)) {
        break;
      }
      this.pos++;
      const right = this.parseUnary();
      if (tok.value === '*') left = left * right;
      else if (tok.value === '/') left = left / right;
      else left = left ** right;
    }
    return left;
  }

  private parseUnary(): number {
    const tok = this.tokens[this.pos];
    if (tok?.type === 'op' && tok.value === '-') {
      this.pos++;
      return -this.parseUnary();
    }
    if (tok?.type === 'op' && tok.value === '+') {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.tokens[this.pos];
    if (!tok) throw new FormulaError('unexpected end of expression');

    if (tok.type === 'number') {
      this.pos++;
      return tok.value;
    }

    if (tok.type === 'ident') {
      const name = tok.value;
      this.pos++;
      if (this.tokens[this.pos]?.type === 'lparen') {
        if (!(name in ALLOWED_FUNCTIONS)) {
          throw new FormulaError(`function not allowed: ${name}`);
        }
        this.pos++;
        const args: number[] = [];
        if (this.tokens[this.pos]?.type !== 'rparen') {
          args.push(this.parseTernary());
          while (this.tokens[this.pos]?.type === 'comma') {
            this.pos++;
            args.push(this.parseTernary());
          }
        }
        if (this.tokens[this.pos]?.type !== 'rparen') {
          throw new FormulaError('expected )');
        }
        this.pos++;
        return ALLOWED_FUNCTIONS[name](...args);
      }
      if (name in ALLOWED_CONSTANTS) return ALLOWED_CONSTANTS[name];
      if (!this.allowedNames.has(name)) {
        throw new FormulaError(`unknown variable or name: ${name}`);
      }
      if (!(name in this.variables)) {
        throw new FormulaError(`missing value for variable: ${name}`);
      }
      return this.variables[name];
    }

    if (tok.type === 'lparen') {
      this.pos++;
      const val = this.parseTernary();
      if (this.tokens[this.pos]?.type !== 'rparen') {
        throw new FormulaError('expected )');
      }
      this.pos++;
      return val;
    }

    throw new FormulaError(`unexpected token: ${JSON.stringify(tok)}`);
  }
}

export function validateExpression(
  expression: string,
  variables: Record<string, number>,
): number {
  const expr = (expression || '').trim();
  if (!expr) throw new FormulaError('expression is empty');
  const tokens = tokenize(expr);
  const allowed = new Set([
    ...Object.keys(variables),
    ...Object.keys(ALLOWED_CONSTANTS),
  ]);
  const result = new Parser(tokens, variables, allowed).parse();
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new FormulaError('expression must evaluate to a finite number');
  }
  return result;
}

export class FormulaCatalog {
  constructor(public overrides: Record<string, string> = {}) {}

  expression(formulaId: string): string {
    if (!(formulaId in FORMULA_DEFAULTS)) {
      throw new KeyError(formulaId);
    }
    return (
      this.overrides[formulaId] ?? FORMULA_DEFAULTS[formulaId].expression
    );
  }

  defaultExpression(formulaId: string): string {
    return FORMULA_DEFAULTS[formulaId].expression;
  }

  eval(formulaId: string, variables: Record<string, number>): number {
    const meta = FORMULA_DEFAULTS[formulaId];
    for (const name of meta.variables) {
      if (!(name in variables)) {
        throw new FormulaError(`${formulaId}: missing variable ${name}`);
      }
    }
    const allowed: Record<string, number> = {};
    for (const name of meta.variables) {
      allowed[name] = Number(variables[name]);
    }
    return validateExpression(this.expression(formulaId), allowed);
  }

  validateAll(payload: Record<string, string>): Record<string, string> {
    const merged = { ...this.overrides };
    for (const [fid, expr] of Object.entries(payload)) {
      if (!(fid in FORMULA_DEFAULTS)) {
        throw new FormulaError(`unknown formula id: ${fid}`);
      }
      const trimmed = (expr || '').trim();
      if (!trimmed) throw new FormulaError(`${fid}: expression is empty`);
      const sample = FORMULA_DEFAULTS[fid].sample;
      validateExpression(trimmed, { ...sample });
      if (trimmed === FORMULA_DEFAULTS[fid].expression) {
        delete merged[fid];
      } else {
        merged[fid] = trimmed;
      }
    }
    return merged;
  }

  toAdminDict(): { formulas: Array<Record<string, unknown>> } {
    const formulas = Object.entries(FORMULA_DEFAULTS).map(([fid, meta]) => {
      const current = this.expression(fid);
      return {
        id: fid,
        label: meta.label,
        category: meta.category,
        description: meta.description,
        variables: [...meta.variables],
        expression: current,
        defaultExpression: meta.expression,
        isDefault: current === meta.expression,
      };
    });
    return { formulas };
  }
}

class KeyError extends Error {
  constructor(id: string) {
    super(`unknown formula id: ${id}`);
    this.name = 'KeyError';
  }
}

export const DEFAULT_FORMULAS = new FormulaCatalog();
