/**
 * CRUD operations for memory entries using LanceDB and embedding models
 */

import type { MemoryEntry, SourceType } from './schema.js';
import { lancedbPool } from './database.js';
import { modelManager } from '../model/index.js';
import { SUPPORTED_MODELS } from '../model/types.js';
import { randomUUID } from 'crypto';

const MEMORY_TABLE = 'memory_entries';

/** Default embedding model for memory */
const DEFAULT_EMBEDDING_MODEL = SUPPORTED_MODELS.BGE_LARGE;

/**
 * Compute SHA-256 hash of content
 */
async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize the memory table schema
 */
async function initializeTable(connection: Awaited<ReturnType<typeof lancedbPool.connect>>): Promise<void> {
  try {
    await connection.createTable(MEMORY_TABLE, [{
      id: 'string',
      text: 'string',
      vector: 'float32Array',
      sourceType: 'string',
      sourcePath: 'string',
      timestamp: 'int64',
      contentHash: 'string',
      metadataJson: 'string',
      sessionId: 'string',
    }]);
  } catch {
    // Table already exists, ignore
  }
}

/**
 * Generate a unique ID using UUID v4
 */
function generateId(): string {
  return randomUUID();
}

/**
 * Add a new memory entry with embedding generation and deduplication
 */
export async function addMemory(
  entry: Omit<MemoryEntry, 'id' | 'vector' | 'timestamp' | 'contentHash'>
): Promise<MemoryEntry> {
  // Compute content hash for deduplication
  const contentHash = await computeHash(entry.text);

  // Load model and generate embedding
  await modelManager.loadModel(DEFAULT_EMBEDDING_MODEL);
  const vector = await modelManager.generateEmbedding(entry.text, DEFAULT_EMBEDDING_MODEL);

  const now = Date.now();
  const fullEntry: MemoryEntry = {
    ...entry,
    id: generateId(),
    vector,
    timestamp: now,
    contentHash,
  };

  // Check for duplicate by contentHash before insert
  const connection = await lancedbPool.connect('memory://');
  await initializeTable(connection);

  const table = await lancedbPool.getTable('memory://', MEMORY_TABLE);
  const existingResults = await table.query().where(`contentHash = '${contentHash}'`).limit(1).toArray();
  
  if (existingResults.length > 0) {
    throw new Error(`Duplicate memory entry with contentHash: ${contentHash}`);
  }

  // Convert to Record<string, unknown> for LanceDB compatibility
  await table.add([fullEntry as unknown as Record<string, unknown>]);
  return fullEntry;
}

/**
 * Get a memory entry by ID
 */
export async function getMemory(id: string): Promise<MemoryEntry | null> {
  try {
    const connection = await lancedbPool.connect('memory://');
    await initializeTable(connection);

    const table = await lancedbPool.getTable('memory://', MEMORY_TABLE);
    const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
    
    if (results.length === 0) {
      return null;
    }
    return results[0] as MemoryEntry;
  } catch {
    return null;
  }
}

/**
 * Delete a memory entry by ID
 */
export async function deleteMemory(id: string): Promise<boolean> {
  try {
    const connection = await lancedbPool.connect('memory://');
    await initializeTable(connection);

    const table = await lancedbPool.getTable('memory://', MEMORY_TABLE);
    await table.delete(`id = '${id}'`);
    return true;
  } catch {
    return false;
  }
}

/**
 * List unique source paths, optionally filtered by source type
 */
export async function listSources(sourceType?: SourceType): Promise<string[]> {
  try {
    const connection = await lancedbPool.connect('memory://');
    await initializeTable(connection);

    const table = await lancedbPool.getTable('memory://', MEMORY_TABLE);
    const results = await table.query().select(['sourcePath', 'sourceType']).toArray();
    
    const paths = new Set<string>();
    for (const row of results) {
      const entry = row as { sourcePath: string; sourceType: string };
      if (!sourceType || entry.sourceType === sourceType) {
        paths.add(entry.sourcePath);
      }
    }
    
    return Array.from(paths);
  } catch {
    return [];
  }
}

/**
 * Save a context entry for a session
 */
export async function saveContext(sessionId: string, context: string): Promise<MemoryEntry> {
  return addMemory({
    text: context,
    sourceType: 'conversation',
    sourcePath: `session://${sessionId}`,
    metadataJson: JSON.stringify({ type: 'context' }),
    sessionId,
  });
}

/**
 * Get the most recent context entry for a session
 */
export async function getContext(sessionId: string): Promise<MemoryEntry | null> {
  try {
    const connection = await lancedbPool.connect('memory://');
    await initializeTable(connection);

    const table = await lancedbPool.getTable('memory://', MEMORY_TABLE);
    // Get all entries for session, sort in memory (LanceDB doesn't support ORDER BY on arbitrary columns)
    const results = await table.query()
      .where(`sessionId = '${sessionId}' AND sourceType = 'conversation'`)
      .toArray();
    
    if (results.length === 0) {
      return null;
    }
    
    // Sort by timestamp descending to get most recent
    const sorted = (results as MemoryEntry[]).sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0];
  } catch {
    return null;
  }
}

/**
 * Get the LanceDB table instance for advanced operations
 */
export async function getMemoryTable() {
  const connection = await lancedbPool.connect('memory://');
  await initializeTable(connection);
  return lancedbPool.getTable('memory://', MEMORY_TABLE);
}
