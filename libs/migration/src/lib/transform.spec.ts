import { parseCsv, parseJson } from './extract';
import { transform } from './transform';

describe('parseCsv', () => {
  it('parses headers and rows', () => {
    const rows = parseCsv('a,b,c\n1,2,3\n4,5,6');
    expect(rows).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('name,note\n"Globex, Inc.","She said ""hi"""');
    expect(rows[0]).toEqual({
      name: 'Globex, Inc.',
      note: 'She said "hi"',
    });
  });

  it('ignores trailing blank lines', () => {
    const rows = parseCsv('a\n1\n\n');
    expect(rows).toEqual([{ a: '1' }]);
  });
});

describe('parseJson', () => {
  it('wraps a single object in an array and stringifies nested values', () => {
    const rows = parseJson('{"sourceId":"X","meta":{"k":1}}');
    expect(rows[0]['sourceId']).toBe('X');
    expect(rows[0]['meta']).toBe('{"k":1}');
  });
});

describe('transform — customers', () => {
  it('marks a valid customer VALID and builds the billing address', () => {
    const result = transform('customer', [
      {
        sourceId: 'C1',
        name: 'Acme',
        billingLine1: '1 Main',
        billingCity: 'Springfield',
        billingState: 'IL',
        billingPostalCode: '62701',
      },
    ]);
    expect(result.validCount).toBe(1);
    expect(result.conflictCount).toBe(0);
    const rec = result.records[0];
    expect(rec.status).toBe('VALID');
    expect(rec.data['billingAddress']).toMatchObject({
      line1: '1 Main',
      city: 'Springfield',
      country: 'US',
    });
  });

  it('flags missing required name as CONFLICT', () => {
    const result = transform('customer', [{ sourceId: 'C2', email: 'x@y.z' }]);
    expect(result.conflictCount).toBe(1);
    expect(result.records[0].status).toBe('CONFLICT');
    expect(result.records[0].conflictReason).toContain('name');
  });

  it('flags duplicate sourceId within the batch', () => {
    const result = transform('customer', [
      { sourceId: 'DUP', name: 'A' },
      { sourceId: 'DUP', name: 'B' },
    ]);
    expect(result.conflictCount).toBe(2);
    expect(result.records.every((r) => r.status === 'CONFLICT')).toBe(true);
    expect(result.records[0].conflictReason).toContain('Duplicate');
  });

  it('flags missing sourceId', () => {
    const result = transform('customer', [{ name: 'NoId' }]);
    expect(result.records[0].status).toBe('CONFLICT');
    expect(result.records[0].conflictReason).toContain('sourceId');
  });
});

describe('transform — products', () => {
  it('requires sku, description, and unitOfMeasure', () => {
    const result = transform('product', [
      { sourceId: 'P1', sku: 'SKU-1', description: 'Bolt', unitOfMeasure: 'EA', inventoryOnHand: '12' },
      { sourceId: 'P2', description: 'No SKU', unitOfMeasure: 'EA' },
    ]);
    expect(result.validCount).toBe(1);
    expect(result.conflictCount).toBe(1);
    expect(result.records[0].data['inventoryOnHand']).toBe(12);
    expect(result.records[1].conflictReason).toContain('sku');
  });

  it('parses currency-formatted numbers', () => {
    const result = transform('product', [
      { sourceId: 'P3', sku: 'SKU-3', description: 'X', unitOfMeasure: 'EA', inventoryOnHand: '1,250' },
    ]);
    expect(result.records[0].data['inventoryOnHand']).toBe(1250);
  });
});

describe('transform — vendors', () => {
  it('requires a name and builds address', () => {
    const result = transform('vendor', [
      { sourceId: 'V1', name: 'Supplier', addressLine1: '5 Way', addressCity: 'Chicago', addressState: 'IL', addressPostalCode: '60601' },
      { sourceId: 'V2', email: 'no@name.com' },
    ]);
    expect(result.validCount).toBe(1);
    expect(result.conflictCount).toBe(1);
    expect(result.records[0].data['address']).toMatchObject({ city: 'Chicago' });
  });
});

describe('transform — quotes', () => {
  it('requires quoteNumber and customerSourceId and parses lineItems JSON', () => {
    const result = transform('quote', [
      {
        sourceId: 'Q1',
        customerSourceId: 'C1',
        quoteNumber: 'Q-1',
        totalAmount: '100',
        lineItems: '[{"sku":"SKU-1","qty":2}]',
      },
      { sourceId: 'Q2', totalAmount: '50' },
    ]);
    expect(result.validCount).toBe(1);
    expect(result.conflictCount).toBe(1);
    expect(result.records[0].data['lineItems']).toEqual([
      { sku: 'SKU-1', qty: 2 },
    ]);
  });

  it('flags invalid lineItems JSON', () => {
    const result = transform('quote', [
      { sourceId: 'Q3', customerSourceId: 'C1', quoteNumber: 'Q-3', lineItems: 'not-json' },
    ]);
    expect(result.records[0].status).toBe('CONFLICT');
    expect(result.records[0].conflictReason).toContain('lineItems');
  });
});
