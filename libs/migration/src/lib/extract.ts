import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/**
 * Extract step: read a legacy export file (CSV or JSON) into an array of
 * string-keyed records. No transformation or validation happens here — the
 * goal is to get raw rows out of whatever the legacy system produced.
 */

export type RawRecord = Record<string, string>;

/**
 * Minimal RFC-4180-style CSV parser supporting quoted fields, escaped quotes
 * (""), and embedded newlines. Avoids pulling in an external dependency for a
 * format this simple, while still handling the common edge cases.
 */
export function parseCsv(content: string): RawRecord[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter(
    (r) => !(r.length === 1 && r[0].trim() === ''),
  );

  if (nonEmpty.length === 0) {
    return [];
  }

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const record: RawRecord = {};
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] ?? '').trim();
    });
    return record;
  });
}

export function parseJson(content: string): RawRecord[] {
  const data = JSON.parse(content);
  const array = Array.isArray(data) ? data : [data];
  return array.map((item: Record<string, unknown>) => {
    const record: RawRecord = {};
    for (const [key, value] of Object.entries(item)) {
      if (value === null || value === undefined) {
        continue;
      }
      record[key] =
        typeof value === 'string' ? value : JSON.stringify(value);
    }
    return record;
  });
}

export function extractRecords(filePath: string): RawRecord[] {
  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.json') {
    return parseJson(content);
  }
  if (ext === '.csv') {
    return parseCsv(content);
  }

  throw new Error(
    `Unsupported legacy export format "${ext}" for ${filePath}. Use .csv or .json.`,
  );
}
