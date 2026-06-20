import { PrismaClient } from '@prisma/client';
import { MigrationEntity, MIGRATION_ENTITIES } from './expected-schemas';

/**
 * Reconcile step: produce a validation/reconciliation report an operations
 * person can review before go-live — record counts in vs. staged, conflicts
 * flagged, and a per-entity breakdown.
 */

export interface EntityReconciliation {
  entity: MigrationEntity;
  extracted: number;
  staged: number;
  valid: number;
  conflicts: number;
  promoted: number;
  conflictSamples: { sourceId: string; reason: string }[];
}

export interface ReconciliationReport {
  batchId: string;
  sourceSystem: string;
  generatedAt: string;
  entities: EntityReconciliation[];
  totals: {
    staged: number;
    valid: number;
    conflicts: number;
    promoted: number;
  };
}

type StagingDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<
    { sourceId: string; conflictReason: string | null }[]
  >;
};

function delegateFor(
  prisma: PrismaClient,
  entity: MigrationEntity,
): StagingDelegate {
  switch (entity) {
    case 'customer':
      return prisma.stagingCustomer as unknown as StagingDelegate;
    case 'vendor':
      return prisma.stagingVendor as unknown as StagingDelegate;
    case 'product':
      return prisma.stagingProduct as unknown as StagingDelegate;
    case 'quote':
      return prisma.stagingQuote as unknown as StagingDelegate;
  }
}

export async function reconcile(
  prisma: PrismaClient,
  batchId: string,
  extractedCounts: Partial<Record<MigrationEntity, number>> = {},
): Promise<ReconciliationReport> {
  const batch = await prisma.migrationBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new Error(`Migration batch ${batchId} not found`);
  }

  const entities: EntityReconciliation[] = [];

  for (const entity of MIGRATION_ENTITIES) {
    const delegate = delegateFor(prisma, entity);
    const [staged, valid, conflicts, promoted, conflictRows] = await Promise.all([
      delegate.count({ where: { batchId } }),
      delegate.count({ where: { batchId, status: 'VALID' } }),
      delegate.count({ where: { batchId, status: 'CONFLICT' } }),
      delegate.count({ where: { batchId, status: 'PROMOTED' } }),
      delegate.findMany({
        where: { batchId, status: 'CONFLICT' },
        select: { sourceId: true, conflictReason: true },
        take: 25,
      }),
    ]);

    entities.push({
      entity,
      extracted: extractedCounts[entity] ?? staged,
      staged,
      valid,
      conflicts,
      promoted,
      conflictSamples: conflictRows.map((r) => ({
        sourceId: r.sourceId,
        reason: r.conflictReason ?? 'unspecified',
      })),
    });
  }

  return {
    batchId,
    sourceSystem: batch.sourceSystem,
    generatedAt: new Date().toISOString(),
    entities,
    totals: {
      staged: entities.reduce((s, e) => s + e.staged, 0),
      valid: entities.reduce((s, e) => s + e.valid, 0),
      conflicts: entities.reduce((s, e) => s + e.conflicts, 0),
      promoted: entities.reduce((s, e) => s + e.promoted, 0),
    },
  };
}

export function formatReport(report: ReconciliationReport): string {
  const lines: string[] = [];
  lines.push('========================================================');
  lines.push('  Data Migration — Reconciliation Report');
  lines.push('========================================================');
  lines.push(`Batch:        ${report.batchId}`);
  lines.push(`Source:       ${report.sourceSystem}`);
  lines.push(`Generated:    ${report.generatedAt}`);
  lines.push('');
  lines.push(
    'Entity     | Extracted | Staged | Valid | Conflicts | Promoted',
  );
  lines.push(
    '-----------|-----------|--------|-------|-----------|---------',
  );
  for (const e of report.entities) {
    lines.push(
      `${e.entity.padEnd(10)} | ${String(e.extracted).padStart(9)} | ${String(
        e.staged,
      ).padStart(6)} | ${String(e.valid).padStart(5)} | ${String(
        e.conflicts,
      ).padStart(9)} | ${String(e.promoted).padStart(8)}`,
    );
  }
  lines.push(
    '-----------|-----------|--------|-------|-----------|---------',
  );
  lines.push(
    `${'TOTAL'.padEnd(10)} | ${''.padStart(9)} | ${String(
      report.totals.staged,
    ).padStart(6)} | ${String(report.totals.valid).padStart(5)} | ${String(
      report.totals.conflicts,
    ).padStart(9)} | ${String(report.totals.promoted).padStart(8)}`,
  );

  const flagged = report.entities.filter((e) => e.conflicts > 0);
  if (flagged.length > 0) {
    lines.push('');
    lines.push('Flagged conflicts (review required before promote):');
    for (const e of flagged) {
      lines.push(`  ${e.entity}:`);
      for (const c of e.conflictSamples) {
        lines.push(`    - [${c.sourceId}] ${c.reason}`);
      }
      if (e.conflicts > e.conflictSamples.length) {
        lines.push(
          `    ... and ${e.conflicts - e.conflictSamples.length} more`,
        );
      }
    }
  } else {
    lines.push('');
    lines.push('No conflicts flagged. Batch is clean for promotion.');
  }

  lines.push('========================================================');
  return lines.join('\n');
}
