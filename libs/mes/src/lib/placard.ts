/** Code128-B bar patterns (11 modules each). Index = symbol value. */
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
];

const START_B = 104;
const STOP = 106;

function encodeCode128B(value: string): number[] {
  const codes: number[] = [START_B];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i) - 32;
    if (code < 0 || code > 94) {
      throw new Error(`Unsupported character for Code128-B: ${value[i]}`);
    }
    codes.push(code);
  }
  let checksum = START_B;
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(STOP);
  return codes;
}

export function encodeCode128Svg(value: string, height = 60): string {
  const codes = encodeCode128B(value);
  const modules: string[] = [];
  for (const code of codes) {
    modules.push(CODE128_PATTERNS[code] ?? '');
  }
  const pattern = modules.join('');
  const moduleWidth = 2;
  let x = 0;
  const bars: string[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      bars.push(
        `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#000"/>`,
      );
    }
    x += moduleWidth;
  }
  const width = pattern.length * moduleWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars.join('')}</svg>`;
}

export interface PlacardOperation {
  sequence: number;
  name: string;
  status: string;
  workstationCode?: string | null;
}

export interface PlacardWorkOrder {
  woNumber: string;
  productSku?: string;
  quantity: number;
  status: string;
}

export function renderPlacardHtml(
  workOrder: PlacardWorkOrder,
  operations: PlacardOperation[],
): string {
  const barcode = encodeCode128Svg(workOrder.woNumber);
  const opRows = operations
    .map(
      (op) =>
        `<tr><td>${op.sequence}</td><td>${escapeHtml(op.name)}</td><td>${escapeHtml(op.workstationCode ?? '—')}</td><td>${op.status}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Traveler ${escapeHtml(workOrder.woNumber)}</title>
  <style>
    body { font-family: sans-serif; padding: 24px; }
    h1 { margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    .barcode { margin: 16px 0; }
  </style>
</head>
<body>
  <h1>Work Order Traveler</h1>
  <p><strong>WO:</strong> ${escapeHtml(workOrder.woNumber)}</p>
  <p><strong>Product:</strong> ${escapeHtml(workOrder.productSku ?? '—')}</p>
  <p><strong>Qty:</strong> ${workOrder.quantity}</p>
  <p><strong>Status:</strong> ${workOrder.status}</p>
  <div class="barcode">${barcode}</div>
  <table>
    <thead><tr><th>#</th><th>Operation</th><th>Workstation</th><th>Status</th></tr></thead>
    <tbody>${opRows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
