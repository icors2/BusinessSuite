/**
 * Data Migration CLI (Phase 2).
 *
 * Safe, idempotent, re-runnable ETL from legacy exports into the Phase 1 Master
 * Data schema. Loads into a staging area first; promotion to production tables
 * is a separate, explicit step after the reconciliation report is reviewed.
 *
 * Usage:
 *   ts-node scripts/migrate.ts ingest    --source <name> [--dir <dir>] [--customers f] [--vendors f] [--products f] [--quotes f] [--batch <id>]
 *   ts-node scripts/migrate.ts reconcile --batch <id> [--out <file>]
 *   ts-node scripts/migrate.ts promote   --batch <id>
 *   ts-node scripts/migrate.ts rollback  --batch <id>
 *   ts-node scripts/migrate.ts run       --source <name> --dir <dir>   (ingest + reconcile)
 *
 * In a --dir, files are auto-detected by name: customers.(csv|json),
 * vendors.(csv|json), products.(csv|json), quotes.(csv|json).
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatReport,
  ingest,
  promote,
  reconcile,
  rollback,
  SourceFileMap,
} from '../libs/migration/src';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const command = argv[0] ?? 'help';
  const args: Args = {};
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return { command, args };
}

function resolveDir(dir: string): SourceFileMap {
  const files: SourceFileMap = {};
  const map: [keyof SourceFileMap, string][] = [
    ['customer', 'customers'],
    ['vendor', 'vendors'],
    ['product', 'products'],
    ['quote', 'quotes'],
  ];
  for (const [entity, base] of map) {
    for (const ext of ['csv', 'json']) {
      const candidate = join(dir, `${base}.${ext}`);
      if (existsSync(candidate)) {
        files[entity] = candidate;
        break;
      }
    }
  }
  return files;
}

function fileMapFromArgs(args: Args): SourceFileMap {
  if (typeof args['dir'] === 'string') {
    return resolveDir(args['dir']);
  }
  const files: SourceFileMap = {};
  if (typeof args['customers'] === 'string') files.customer = args['customers'];
  if (typeof args['vendors'] === 'string') files.vendor = args['vendors'];
  if (typeof args['products'] === 'string') files.product = args['products'];
  if (typeof args['quotes'] === 'string') files.quote = args['quotes'];
  return files;
}

function requireString(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing required --${key} argument`);
  }
  return value;
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    switch (command) {
      case 'ingest':
      case 'run': {
        const source = requireString(args, 'source');
        const files = fileMapFromArgs(args);
        if (Object.keys(files).length === 0) {
          throw new Error(
            'No source files. Provide --dir <dir> or --customers/--vendors/--products/--quotes <file>.',
          );
        }
        const result = await ingest(prisma, source, files, {
          batchId: typeof args['batch'] === 'string' ? args['batch'] : undefined,
          notes: typeof args['notes'] === 'string' ? args['notes'] : undefined,
        });
        console.log(`Batch ${result.batchId} loaded from source "${source}":`);
        for (const load of result.loads) {
          console.log(
            `  ${load.entity.padEnd(9)} loaded=${load.loaded} valid=${load.valid} conflicts=${load.conflicts}`,
          );
        }

        if (command === 'run') {
          const report = await reconcile(
            prisma,
            result.batchId,
            result.extractedCounts,
          );
          console.log('\n' + formatReport(report));
          writeReport(report.batchId, report);
        } else {
          console.log(
            `\nReview before promote:\n  ts-node scripts/migrate.ts reconcile --batch ${result.batchId}`,
          );
        }
        break;
      }

      case 'reconcile': {
        const batchId = requireString(args, 'batch');
        const report = await reconcile(prisma, batchId);
        const text = formatReport(report);
        console.log(text);
        const out =
          typeof args['out'] === 'string'
            ? args['out']
            : writeReport(batchId, report);
        console.log(`\nReport written to: ${out}`);
        break;
      }

      case 'promote': {
        const batchId = requireString(args, 'batch');
        const report = await reconcile(prisma, batchId);
        if (report.totals.conflicts > 0) {
          console.warn(
            `WARNING: ${report.totals.conflicts} conflict(s) remain; conflicted records will NOT be promoted.`,
          );
        }
        const result = await promote(prisma, batchId);
        console.log(`Batch ${batchId} promoted:`);
        console.log(
          `  customers: +${result.customers.promoted} (skipped ${result.customers.skipped})`,
        );
        console.log(
          `  vendors:   +${result.vendors.promoted} (skipped ${result.vendors.skipped})`,
        );
        console.log(
          `  products:  +${result.products.promoted} (skipped ${result.products.skipped})`,
        );
        console.log(
          `  quotes:    ${result.quotes.held} held for Phase 6 (CPQ)`,
        );
        break;
      }

      case 'rollback': {
        const batchId = requireString(args, 'batch');
        const result = await rollback(prisma, batchId);
        console.log(`Batch ${batchId} rolled back:`);
        console.log(`  customers deleted: ${result.customersDeleted}`);
        console.log(`  vendors deleted:   ${result.vendorsDeleted}`);
        console.log(`  products deleted:  ${result.productsDeleted}`);
        break;
      }

      default:
        printHelp();
    }
  } finally {
    await prisma.$disconnect();
  }
}

function writeReport(batchId: string, report: unknown): string {
  const dir = join(process.cwd(), 'migration-output');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `reconciliation-${batchId}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  return path;
}

function printHelp(): void {
  console.log(`Data Migration CLI (Phase 2)

Commands:
  ingest     Extract + transform + load legacy files into staging
  reconcile  Generate the reconciliation report for a batch
  promote    Promote VALID staged records into production Master Data
  rollback   Undo a promoted batch (delete created records, reset staging)
  run        ingest + reconcile in one step

Examples:
  ts-node scripts/migrate.ts run       --source legacy-erp --dir data/legacy-samples
  ts-node scripts/migrate.ts reconcile --batch <id>
  ts-node scripts/migrate.ts promote   --batch <id>
  ts-node scripts/migrate.ts rollback  --batch <id>
`);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
