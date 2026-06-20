import {
  expectedSchemas,
  LegacyCustomer,
  LegacyProduct,
  LegacyQuote,
  LegacyVendor,
  MigrationEntity,
} from './expected-schemas';
import { RawRecord } from './extract';

/**
 * Transform step: map raw legacy rows onto the Phase 1 Prisma shapes and detect
 * conflicts (missing required fields, in-batch duplicates). Nothing is dropped
 * silently — every conflict is recorded with a human-readable reason so it
 * lands in the review file.
 */

export type RecordStatus = 'VALID' | 'CONFLICT';

export interface TransformedRecord {
  sourceId: string;
  status: RecordStatus;
  conflictReason?: string;
  raw: RawRecord;
  data: Record<string, unknown>;
}

export interface TransformResult {
  entity: MigrationEntity;
  records: TransformedRecord[];
  validCount: number;
  conflictCount: number;
}

interface Address {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
}

function buildAddress(
  line1?: string,
  city?: string,
  state?: string,
  postalCode?: string,
  country?: string,
): Address | undefined {
  if (!line1 && !city && !state && !postalCode) {
    return undefined;
  }
  return {
    line1,
    city,
    state,
    postalCode,
    country: country ?? 'US',
  };
}

function parseNumber(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Detect duplicate sourceIds within a batch and apply per-entity required-field
 * rules. Returns records annotated with VALID/CONFLICT status.
 */
export function transform(
  entity: MigrationEntity,
  rawRecords: RawRecord[],
): TransformResult {
  const schema = expectedSchemas[entity];
  const seenSourceIds = new Map<string, number>();
  for (const raw of rawRecords) {
    const sid = (raw['sourceId'] ?? '').trim();
    if (sid) {
      seenSourceIds.set(sid, (seenSourceIds.get(sid) ?? 0) + 1);
    }
  }

  const records: TransformedRecord[] = rawRecords.map((raw, index) => {
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'record'}: ${i.message}`)
        .join('; ');
      return {
        sourceId: (raw['sourceId'] ?? `row-${index + 1}`).trim(),
        status: 'CONFLICT',
        conflictReason: reason,
        raw,
        data: {},
      };
    }

    const sourceId = parsed.data.sourceId;

    if ((seenSourceIds.get(sourceId) ?? 0) > 1) {
      return {
        sourceId,
        status: 'CONFLICT',
        conflictReason: `Duplicate sourceId "${sourceId}" appears multiple times in this batch`,
        raw,
        data: {},
      };
    }

    return mapEntity(entity, sourceId, parsed.data, raw);
  });

  return {
    entity,
    records,
    validCount: records.filter((r) => r.status === 'VALID').length,
    conflictCount: records.filter((r) => r.status === 'CONFLICT').length,
  };
}

function mapEntity(
  entity: MigrationEntity,
  sourceId: string,
  data:
    | LegacyCustomer
    | LegacyVendor
    | LegacyProduct
    | LegacyQuote,
  raw: RawRecord,
): TransformedRecord {
  const missing: string[] = [];
  const conflict = (reason: string): TransformedRecord => ({
    sourceId,
    status: 'CONFLICT',
    conflictReason: reason,
    raw,
    data: {},
  });
  const ok = (mapped: Record<string, unknown>): TransformedRecord => ({
    sourceId,
    status: 'VALID',
    raw,
    data: mapped,
  });

  switch (entity) {
    case 'customer': {
      const c = data as LegacyCustomer;
      if (!c.name) missing.push('name');
      if (missing.length > 0) {
        return conflict(`Missing required field(s): ${missing.join(', ')}`);
      }
      return ok({
        name: c.name,
        email: c.email,
        phone: c.phone,
        billingAddress: buildAddress(
          c.billingLine1,
          c.billingCity,
          c.billingState,
          c.billingPostalCode,
          c.billingCountry,
        ),
        shippingAddress: buildAddress(
          c.shippingLine1,
          c.shippingCity,
          c.shippingState,
          c.shippingPostalCode,
          c.shippingCountry,
        ),
        creditTerms: c.creditTerms,
      });
    }
    case 'vendor': {
      const v = data as LegacyVendor;
      if (!v.name) missing.push('name');
      if (missing.length > 0) {
        return conflict(`Missing required field(s): ${missing.join(', ')}`);
      }
      return ok({
        name: v.name,
        email: v.email,
        phone: v.phone,
        address: buildAddress(
          v.addressLine1,
          v.addressCity,
          v.addressState,
          v.addressPostalCode,
          v.addressCountry,
        ),
        paymentTerms: v.paymentTerms,
      });
    }
    case 'product': {
      const p = data as LegacyProduct;
      if (!p.sku) missing.push('sku');
      if (!p.description) missing.push('description');
      if (!p.unitOfMeasure) missing.push('unitOfMeasure');
      if (missing.length > 0) {
        return conflict(`Missing required field(s): ${missing.join(', ')}`);
      }
      return ok({
        sku: p.sku,
        description: p.description,
        unitOfMeasure: p.unitOfMeasure,
        category: p.category,
        inventoryOnHand: parseNumber(p.inventoryOnHand),
      });
    }
    case 'quote': {
      const q = data as LegacyQuote;
      if (!q.quoteNumber) missing.push('quoteNumber');
      if (!q.customerSourceId) missing.push('customerSourceId');
      if (missing.length > 0) {
        return conflict(`Missing required field(s): ${missing.join(', ')}`);
      }
      let lineItems: unknown;
      if (q.lineItems) {
        try {
          lineItems = JSON.parse(q.lineItems);
        } catch {
          return conflict('lineItems is not valid JSON');
        }
      }
      return ok({
        customerSourceId: q.customerSourceId,
        quoteNumber: q.quoteNumber,
        status_legacy: q.status,
        totalAmount: parseNumber(q.totalAmount),
        currency: q.currency,
        quotedAt: parseDate(q.quotedAt),
        lineItems,
      });
    }
    default:
      return conflict(`Unknown entity type: ${entity}`);
  }
}
