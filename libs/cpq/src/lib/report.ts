/** Customer/internal quote breakdown report (ported from FabQuote report.py). */
import { AssemblyResult } from './engine';
import { QuotePricingResult } from './pricing';

const OP_ORDER = [
  'laser',
  'tube_laser',
  'saw',
  'drill',
  'tap',
  'machine',
  'press',
  'weld',
  'blast',
  'powder',
];

const OP_LABEL: Record<string, string> = {
  laser: 'Laser',
  tube_laser: 'Tube laser',
  saw: 'Saw',
  drill: 'Drill',
  tap: 'Tap',
  machine: 'Machine',
  press: 'Press',
  weld: 'Weld',
  blast: 'Blast',
  powder: 'Powder',
};

export function buildFabLineItems(result: AssemblyResult): Array<Record<string, unknown>> {
  return result.parts.map((p, i) => {
    const ops = Object.fromEntries(p.ops.map((o) => [o.process, o]));
    const opCosts: Record<string, number> = {};
    for (const proc of OP_ORDER) {
      if (ops[proc]) opCosts[proc] = Math.round(ops[proc].cost * 10000) / 10000;
    }
    const opDetail = OP_ORDER.filter((proc) => ops[proc])
      .map(
        (proc) =>
          `${OP_LABEL[proc] ?? proc}: $${ops[proc].cost.toFixed(2)} (${ops[proc].minutes.toFixed(2)} min)`,
      )
      .join('; ');

    return {
      line: i + 1,
      itemNumber: p.part.itemNumber,
      description: p.part.name,
      type: p.part.kind,
      qty: p.qtyInAssembly,
      materialEach: Math.round(p.materialCost * 10000) / 10000,
      laborEach: Math.round(p.laborCost * 10000) / 10000,
      unitCost: Math.round(p.unitCost * 10000) / 10000,
      extendedCost: Math.round(p.extendedCost * 10000) / 10000,
      setups: p.setups,
      operations: opDetail,
      opCosts,
    };
  });
}

export function buildFabCsv(
  result: AssemblyResult,
  pricing: QuotePricingResult,
): string {
  const lines: string[] = [];
  const asm = result.assembly;
  lines.push(`Quote,${asm.name}`);
  lines.push(`Item number,${asm.itemNumber}`);
  lines.push(`Customer,${asm.customer}`);
  lines.push('');
  lines.push(
    'Line,Item Number,Description,Type,Qty,Material (ea),Labor (ea),Unit Cost (ea),Extended Cost,Setups,Operations',
  );
  for (const r of buildFabLineItems(result)) {
    lines.push(
      [
        r['line'],
        r['itemNumber'],
        r['description'],
        r['type'],
        r['qty'],
        Number(r['materialEach']).toFixed(4),
        Number(r['laborEach']).toFixed(4),
        Number(r['unitCost']).toFixed(4),
        Number(r['extendedCost']).toFixed(4),
        r['setups'],
        r['operations'],
      ].join(','),
    );
  }
  lines.push('');
  lines.push(
    ['', '', '', '', 'TOTALS', result.materialCost.toFixed(4), result.laborCost.toFixed(4), result.unitCost.toFixed(4), result.unitCost.toFixed(4), result.totalSetups, ''].join(','),
  );
  lines.push('');
  lines.push(`Setup charge,${pricing.setupCost.toFixed(2)}`);
  lines.push('');
  lines.push('Quantity,Unit Price,Extended Price');
  for (const b of pricing.breaks) {
    lines.push(`${b.qty},${b.unitPrice.toFixed(2)},${b.extendedPrice.toFixed(2)}`);
  }
  return lines.join('\n');
}

export function buildQuotePrintLines(
  quote: {
    quoteNumber: string;
    customer?: { name: string } | null;
    validUntil?: Date | null;
    status: string;
    subtotal: unknown;
    discountTotal: unknown;
    total: unknown;
    currency: string;
    lines: Array<{
      lineNumber: number;
      kind: string;
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      discountPct: unknown;
      lineTotal: unknown;
      product?: { sku: string } | null;
    }>;
  },
): string {
  const rows: string[] = [];
  rows.push(`Quote,${quote.quoteNumber}`);
  rows.push(`Customer,${quote.customer?.name ?? ''}`);
  rows.push(`Status,${quote.status}`);
  if (quote.validUntil) {
    rows.push(`Valid Until,${quote.validUntil.toISOString().slice(0, 10)}`);
  }
  rows.push('');
  rows.push('Line,SKU/Type,Description,Qty,Unit Price,Discount %,Line Total');
  for (const line of quote.lines) {
    rows.push(
      [
        line.lineNumber,
        line.product?.sku ?? line.kind,
        `"${line.description.replace(/"/g, '""')}"`,
        String(line.quantity),
        String(line.unitPrice),
        String(line.discountPct),
        String(line.lineTotal),
      ].join(','),
    );
  }
  rows.push('');
  rows.push(`Subtotal,${quote.subtotal}`);
  rows.push(`Discount,${quote.discountTotal}`);
  rows.push(`Total (${quote.currency}),${quote.total}`);
  return rows.join('\n');
}
