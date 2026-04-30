#!/usr/bin/env tsx
/**
 * Migration script: LanceDB → Qdrant
 * 
 * Migrates existing memories from LanceDB to Qdrant using Super-Memory-TS.
 * Supports resume via state file and dry-run validation.
 */

import { connect, type Table, type Connection } from '@lancedb/lancedb';
import { MemorySystem } from '@veedubin/super-memory-ts/src/memory/index.js';
import { generateEmbeddings } from '@veedubin/super-memory-ts/src/model/embeddings.js';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Types ---

interface MigrationState {
  startedAt: string;
  lancedbUri: string;
  qdrantUrl: string;
  projectId?: string;
  memoryEntries: { total: number; migrated: number; lastIndex: number };
  projectChunks: { total: number; migrated: number; lastIndex: number };
  errors: Array<{ item: string; error: string; timestamp: string }>;
}

interface LanceDBMemoryEntry {
  id: string;
  text: string;
  sourceType: string;
  sourcePath?: string;
  sessionId?: string;
  metadataJson?: string;
  timestamp?: number;
  contentHash?: string;
}

interface LanceDBProjectChunk {
  id: string;
  content: string;
  filePath: string;
  chunkIndex: number;
  metadataJson?: string;
  timestamp?: number;
  contentHash?: string;
}

// --- CLI Parsing ---

interface CliArgs {
  lancedbUri: string;
  qdrantUrl: string;
  projectId?: string;
  batchSize: number;
  dryRun: boolean;
  resume: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    lancedbUri: process.env.LANCEDB_URI || './memory_data',
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    projectId: process.env.BOOMERANG_PROJECT_ID,
    batchSize: 8,
    dryRun: false,
    resume: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--resume') {
      args.resume = true;
    } else if (arg === '--lancedb-uri' && i + 1 < argv.length) {
      args.lancedbUri = argv[++i];
    } else if (arg === '--qdrant-url' && i + 1 < argv.length) {
      args.qdrantUrl = argv[++i];
    } else if (arg === '--project-id' && i + 1 < argv.length) {
      args.projectId = argv[++i];
    } else if (arg === '--batch-size' && i + 1 < argv.length) {
      args.batchSize = parseInt(argv[++i], 10);
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
LanceDB → Qdrant Migration Script

USAGE:
  npx tsx scripts/migrate-lancedb-to-qdrant.ts [options]

OPTIONS:
  --lancedb-uri <path>   LanceDB URI or directory (default: ./memory_data or env LANCEDB_URI)
  --qdrant-url <url>     Qdrant URL (default: http://localhost:6333 or env QDRANT_URL)
  --project-id <id>      Project ID for isolation (default: env BOOMERANG_PROJECT_ID or cwd basename)
  --batch-size <n>       Embedding batch size (default: 8)
  --dry-run              Validate without writing to Qdrant
  --resume               Resume from previous run using .migration-state.json
  --help                 Show this help

EXAMPLES:
  # Migrate with defaults
  npx tsx scripts/migrate-lancedb-to-qdrant.ts

  # Dry run validation
  npx tsx scripts/migrate-lancedb-to-qdrant.ts --dry-run

  # Resume interrupted migration
  npx tsx scripts/migrate-lancedb-to-qdrant.ts --resume

  # Custom paths
  npx tsx scripts/migrate-lancedb-to-qdrant.ts --lancedb-uri /data/memory --qdrant-url http://qdrant:6333
`);
}

// --- State Management ---

const STATE_FILE = '.migration-state.json';

async function loadState(): Promise<MigrationState | null> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function saveState(state: MigrationState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Hash computation ---

function computeHash(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

// --- Source type mapping ---

function mapSourceType(sourceType: string): 'session' | 'file' | 'web' | 'boomerang' | 'project' {
  switch (sourceType) {
    case 'conversation':
      return 'session';
    case 'manual':
      return 'session';
    case 'file':
      return 'file';
    case 'web':
      return 'web';
    default:
      return 'session';
  }
}

// --- Retry with exponential backoff ---

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = delayMs * Math.pow(2, i);
      console.error(`  Retry ${i + 1}/${retries} after ${delay}ms: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

// --- Main Migration Logic ---

async function migrateMemoryEntries(
  table: Table,
  memorySystem: MemorySystem,
  state: MigrationState,
  args: CliArgs
): Promise<void> {
  console.log('\n📦 Migrating memory_entries table...');

  // Read all rows as array
  const allRows: LanceDBMemoryEntry[] = [];
  const result = await table.query().select(['*']).toArray();
  for (const row of result) {
    allRows.push(row as LanceDBMemoryEntry);
  }

  const total = allRows.length;
  state.memoryEntries.total = total;
  console.log(`  Found ${total} memory entries`);

  if (total === 0) {
    console.log('  No entries to migrate');
    return;
  }

  const startIndex = args.resume ? state.memoryEntries.lastIndex + 1 : 0;
  if (startIndex > 0) {
    console.log(`  Resuming from index ${startIndex}`);
  }

  for (let i = startIndex; i < total; i += args.batchSize) {
    const batch = allRows.slice(i, i + args.batchSize);
    const batchNum = Math.floor(i / args.batchSize) + 1;
    const totalBatches = Math.ceil(total / args.batchSize);

    console.log(`  Batch ${batchNum}/${totalBatches} (${Math.min(i + args.batchSize, total)}/${total})`);

    // Extract texts and generate embeddings
    const texts = batch.map(entry => entry.text || '');

    let embeddingResults;
    try {
      embeddingResults = await withRetry(() => generateEmbeddings(texts, args.batchSize));
    } catch (err) {
      console.error(`  ❌ Embedding generation failed for batch ${batchNum}: ${err instanceof Error ? err.message : String(err)}`);
      state.errors.push({
        item: `batch-${batchNum}`,
        error: `Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
      });
      // Skip batch but continue
      state.memoryEntries.lastIndex = i;
      await saveState(state);
      continue;
    }

    // Insert each entry
    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j];
      const entryIndex = i + j;

      try {
        if (!args.dryRun) {
          // Check for duplicate content hash
          const text = entry.text || '';
          const contentHash = computeHash(text);

          // Check if content already exists
          const exists = await memorySystem.contentExists(text);
          if (exists) {
            console.log(`    Skipping duplicate: ${text.substring(0, 50)}...`);
            state.memoryEntries.migrated++;
            state.memoryEntries.lastIndex = entryIndex;
            continue;
          }

          await withRetry(() => memorySystem.addMemory({
            text,
            sourceType: mapSourceType(entry.sourceType || 'manual'),
            sourcePath: entry.sourcePath,
            sessionId: entry.sessionId,
            metadataJson: entry.metadataJson,
          }));
        }
        state.memoryEntries.migrated++;
      } catch (err) {
        console.error(`  ❌ Failed to migrate entry ${entryIndex}: ${err instanceof Error ? err.message : String(err)}`);
        state.errors.push({
          item: `entry-${entryIndex}`,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        });
      }

      state.memoryEntries.lastIndex = entryIndex;
    }

    // Save state after each batch
    await saveState(state);
  }

  const pct = total > 0 ? ((state.memoryEntries.migrated / total) * 100).toFixed(1) : '0.0';
  console.log(`  ✅ memory_entries: ${state.memoryEntries.migrated}/${total} (${pct}%) migrated, ${state.errors.filter(e => e.item.startsWith('entry-')).length} errors`);
}

async function migrateProjectChunks(
  db: Connection,
  memorySystem: MemorySystem,
  state: MigrationState,
  args: CliArgs
): Promise<void> {
  console.log('\n📦 Migrating project_chunks table...');

  let table: Table | null = null;
  try {
    table = await db.openTable('project_chunks');
  } catch {
    console.log('  ⚠️  project_chunks table not found - skipping');
    return;
  }

  // Read all rows
  const allRows: LanceDBProjectChunk[] = [];
  const result = await table.query().select(['*']).toArray();
  for (const row of result) {
    allRows.push(row as LanceDBProjectChunk);
  }

  const total = allRows.length;
  state.projectChunks.total = total;
  console.log(`  Found ${total} project chunks`);

  if (total === 0) {
    console.log('  No chunks to migrate');
    return;
  }

  // Group by filePath
  const byFilePath = new Map<string, LanceDBProjectChunk[]>();
  for (const chunk of allRows) {
    const existing = byFilePath.get(chunk.filePath) || [];
    existing.push(chunk);
    byFilePath.set(chunk.filePath, existing);
  }

  const files = Array.from(byFilePath.keys());
  console.log(`  Grouped into ${files.length} files`);

  const startIndex = args.resume ? state.projectChunks.lastIndex : 0;
  if (startIndex > 0) {
    console.log(`  Resuming from file ${startIndex}`);
  }

  for (let i = startIndex; i < files.length; i++) {
    const filePath = files[i];
    const chunks = byFilePath.get(filePath)!;
    const batchNum = i + 1;

    console.log(`  File ${batchNum}/${files.length}: ${path.basename(filePath)} (${chunks.length} chunks)`);

    // Process chunks in batches
    for (let j = 0; j < chunks.length; j += args.batchSize) {
      const chunkBatch = chunks.slice(j, j + args.batchSize);
      const texts = chunkBatch.map(c => c.content || '');

      let embeddingResults;
      try {
        embeddingResults = await withRetry(() => generateEmbeddings(texts, args.batchSize));
      } catch (err) {
        console.error(`    ❌ Embedding failed: ${err instanceof Error ? err.message : String(err)}`);
        state.errors.push({
          item: `chunk-${filePath}-${j}`,
          error: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      for (let k = 0; k < chunkBatch.length; k++) {
        const chunk = chunkBatch[k];
        const chunkIndex = j + k;

        try {
          if (!args.dryRun) {
            const text = chunk.content || '';
            const exists = await memorySystem.contentExists(text);
            if (exists) {
              state.projectChunks.migrated++;
              continue;
            }

            await withRetry(() => memorySystem.addMemory({
              text,
              sourceType: 'project',
              sourcePath: chunk.filePath,
              metadataJson: chunk.metadataJson,
            }));
          }
          state.projectChunks.migrated++;
        } catch (err) {
          console.error(`    ❌ Failed chunk ${chunkIndex}: ${err instanceof Error ? err.message : String(err)}`);
          state.errors.push({
            item: `chunk-${chunk.filePath}-${chunkIndex}`,
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    state.projectChunks.lastIndex = i;
    await saveState(state);
  }

  const pct = total > 0 ? ((state.projectChunks.migrated / total) * 100).toFixed(1) : '0.0';
  console.log(`  ✅ project_chunks: ${state.projectChunks.migrated}/${total} (${pct}%) migrated, ${state.errors.filter(e => e.item.startsWith('chunk-')).length} errors`);
}

async function validateMigration(
  memorySystem: MemorySystem,
  state: MigrationState
): Promise<void> {
  console.log('\n🔍 Validating migration...');

  try {
    const qdrantCount = (await memorySystem.getStats()).count;
    const lancedbTotal = state.memoryEntries.total + state.projectChunks.total;
    const migrated = state.memoryEntries.migrated + state.projectChunks.migrated;

    console.log(`  LanceDB entries: ${lancedbTotal}`);
    console.log(`  Migrated successfully: ${migrated}`);
    console.log(`  Qdrant entries: ${qdrantCount}`);

    if (qdrantCount >= migrated) {
      console.log('  ✅ Validation passed');
    } else {
      console.log('  ⚠️  Mismatch detected - some entries may have failed to insert');
    }

    if (state.errors.length > 0) {
      console.log(`  ⚠️  ${state.errors.length} errors during migration`);
      const recentErrors = state.errors.slice(-5);
      for (const err of recentErrors) {
        console.log(`    - ${err.item}: ${err.error}`);
      }
    }
  } catch (err) {
    console.error(`  ❌ Validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function promptBackup(lancedbUri: string): Promise<void> {
  console.log('\n📁 Backup LanceDB data?');
  console.log('  This will rename the LanceDB directory as backup.');
  console.log(`  Source: ${lancedbUri}`);
  console.log('  Target: ${lancedbUri}.backup');
  console.log('\n  To backup now, run:');
  console.log(`    mv "${lancedbUri}" "${lancedbUri}.backup"`);
  console.log('\n  Or manually rename after confirming migration succeeded.');
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    showHelp();
    return;
  }

  console.log('🚀 LanceDB → Qdrant Migration');
  console.log('===========================\n');
  console.log(`  LanceDB URI: ${args.lancedbUri}`);
  console.log(`  Qdrant URL: ${args.qdrantUrl}`);
  console.log(`  Project ID: ${args.projectId || '(default)'}`);
  console.log(`  Batch size: ${args.batchSize}`);
  console.log(`  Dry run: ${args.dryRun}`);

  // Initialize state
  let state: MigrationState;
  if (args.resume) {
    const loaded = await loadState();
    if (!loaded) {
      console.error('❌ --resume specified but no state file found');
      process.exit(1);
    }
    state = loaded;
    console.log('\n📂 Resuming from saved state');
    console.log(`  Memory entries: ${state.memoryEntries.migrated}/${state.memoryEntries.total}`);
    console.log(`  Project chunks: ${state.projectChunks.migrated}/${state.projectChunks.total}`);
  } else {
    state = {
      startedAt: new Date().toISOString(),
      lancedbUri: args.lancedbUri,
      qdrantUrl: args.qdrantUrl,
      projectId: args.projectId,
      memoryEntries: { total: 0, migrated: 0, lastIndex: -1 },
      projectChunks: { total: 0, migrated: 0, lastIndex: -1 },
      errors: [],
    };
  }

  // Open LanceDB (read-only)
  console.log('\n🔌 Connecting to LanceDB...');
  let db: Connection;
  try {
    db = await connect(args.lancedbUri);
    console.log('  ✅ Connected to LanceDB');
  } catch (err) {
    console.error(`❌ Failed to connect to LanceDB: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Initialize MemorySystem (Qdrant)
  console.log('\n🔌 Connecting to Qdrant...');
  const memorySystem = new MemorySystem(undefined, undefined, {
    dbUri: args.qdrantUrl,
    projectId: args.projectId,
  });

  try {
    await withRetry(() => memorySystem.initialize(args.qdrantUrl), 3, 2000);
    console.log('  ✅ Connected to Qdrant');
  } catch (err) {
    console.error(`❌ Failed to connect to Qdrant: ${err instanceof Error ? err.message : String(err)}`);
    console.error('   Ensure Qdrant is running: docker run -p 6333:6333 qdrant/qdrant');
    process.exit(1);
  }

  // Migrate memory_entries
  try {
    const entriesTable = await db.openTable('memory_entries');
    await migrateMemoryEntries(entriesTable, memorySystem, state, args);
  } catch (err) {
    console.error(`❌ Failed to migrate memory_entries: ${err instanceof Error ? err.message : String(err)}`);
    await saveState(state);
    process.exit(1);
  }

  // Migrate project_chunks
  try {
    await migrateProjectChunks(db, memorySystem, state, args);
  } catch (err) {
    console.error(`❌ Failed to migrate project_chunks: ${err instanceof Error ? err.message : String(err)}`);
    await saveState(state);
    process.exit(1);
  }

  // Validate
  await validateMigration(memorySystem, state);

  // Write completion report
  const report = `
========================================
Migration Complete
========================================

Started: ${state.startedAt}
Completed: ${new Date().toISOString()}

Memory Entries:
  Total: ${state.memoryEntries.total}
  Migrated: ${state.memoryEntries.migrated}
  Errors: ${state.errors.filter(e => e.item.startsWith('entry-')).length}

Project Chunks:
  Total: ${state.projectChunks.total}
  Migrated: ${state.projectChunks.migrated}
  Errors: ${state.errors.filter(e => e.item.startsWith('chunk-')).length}

Total Errors: ${state.errors.length}
`;

  if (args.dryRun) {
    console.log(report);
    console.log('\n📝 This was a DRY RUN - no data was written to Qdrant');
  } else {
    await fs.writeFile('migration-report.txt', report);
    console.log(report);
    console.log('📝 Report saved to migration-report.txt');
    await promptBackup(args.lancedbUri);
  }

  // Exit with error if any failures
  if (state.errors.length > 0) {
    console.log('\n⚠️  Migration completed with errors. Run with --resume to retry.');
    process.exit(1);
  }

  console.log('\n✅ Migration completed successfully!');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
