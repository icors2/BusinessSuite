import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { MigrationEntity, MIGRATION_ENTITIES } from './expected-schemas';
import { extractRecords } from './extract';
import { loadStaging, LoadResult } from './load';
import { transform } from './transform';

/**
 * Orchestrates extract -> transform -> load for a batch. Creating a batch and
 * loading staging are separate from promotion so an operator can review the
 * reconciliation report in between.
 */

export interface SourceFileMap {
  customer?: string;
  vendor?: string;
  product?: string;
  quote?: string;
}

export interface IngestResult {
  batchId: string;
  sourceSystem: string;
  loads: LoadResult[];
  extractedCounts: Partial<Record<MigrationEntity, number>>;
}

export async function createBatch(
  prisma: PrismaClient,
  sourceSystem: string,
  notes?: string,
): Promise<string> {
  const batch = await prisma.migrationBatch.create({
    data: { sourceSystem, notes, status: 'EXTRACTED' },
  });
  return batch.id;
}

export async function ingest(
  prisma: PrismaClient,
  sourceSystem: string,
  files: SourceFileMap,
  options: { batchId?: string; notes?: string } = {},
): Promise<IngestResult> {
  const batchId =
    options.batchId ?? (await createBatch(prisma, sourceSystem, options.notes));

  const loads: LoadResult[] = [];
  const extractedCounts: Partial<Record<MigrationEntity, number>> = {};

  for (const entity of MIGRATION_ENTITIES) {
    const filePath = files[entity];
    if (!filePath) {
      continue;
    }
    if (!existsSync(filePath)) {
      throw new Error(`Source file for ${entity} not found: ${filePath}`);
    }

    const raw = extractRecords(filePath);
    extractedCounts[entity] = raw.length;
    const transformed = transform(entity, raw);
    const load = await loadStaging(prisma, batchId, sourceSystem, transformed);
    loads.push(load);
  }

  await prisma.migrationBatch.update({
    where: { id: batchId },
    data: { status: 'LOADED' },
  });

  return { batchId, sourceSystem, loads, extractedCounts };
}
