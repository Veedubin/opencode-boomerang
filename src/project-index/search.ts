/**
 * Project Search - Vector similarity search for project chunks
 * Uses LanceDB for storage and ModelManager for embeddings
 */

import { lancedbPool } from '../memory/database.js';
import { modelManager } from '../model/index.js';
import { DEFAULT_INDEX_CONFIG } from './types.js';

const TABLE_NAME = 'project_chunks';

/**
 * Search result with file location and relevance score
 */
export interface SearchResult {
  /** File path */
  filePath: string;
  /** Chunk content */
  content: string;
  /** Start line (1-indexed) */
  lineStart: number;
  /** End line (1-indexed) */
  lineEnd: number;
  /** Relevance score (higher = more relevant) */
  score: number;
}

/**
 * Search project chunks for query string
 * @param query - Search query string
 * @param topK - Number of results to return (default: 10)
 * @param dbUri - LanceDB URI (optional, uses default if not provided)
 * @returns Array of search results sorted by relevance
 */
export async function searchProject(
  query: string,
  topK: number = 10,
  dbUri?: string
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const uri = dbUri || process.env.LANCEDB_URI;
  if (!uri) {
    throw new Error('LanceDB URI not provided. Set dbUri parameter or LANCEDB_URI environment variable.');
  }

  // Generate query embedding
  const embedding = await modelManager.generateEmbedding(
    query,
    DEFAULT_INDEX_CONFIG.embeddingModel
  );

  // Connect to database and query
  const db = await lancedbPool.connect(uri);
  const table = await db.openTable(TABLE_NAME);

  // Perform vector similarity search using nearestTo
  const results = await table.query()
    .nearestTo(embedding)
    .limit(topK)
    .toArray();

  // Transform results to SearchResult format
  return results.map((row: Record<string, unknown>) => ({
    filePath: row.filePath as string,
    content: row.content as string,
    lineStart: row.lineStart as number,
    lineEnd: row.lineEnd as number,
    // LanceDB returns _distance, convert to similarity score
    // Distance is euclidean, lower is better, so we invert
    score: row._distance ? 1 / (1 + (row._distance as number)) : 0,
  }));
}

/**
 * Get chunks for a specific file
 * @param filePath - Path to file
 * @param dbUri - LanceDB URI (optional)
 * @returns Array of chunks for the file
 */
export async function getFileChunks(
  filePath: string,
  dbUri?: string
): Promise<SearchResult[]> {
  const uri = dbUri || process.env.LANCEDB_URI;
  if (!uri) {
    throw new Error('LanceDB URI not provided. Set dbUri parameter or LANCEDB_URI environment variable.');
  }

  const db = await lancedbPool.connect(uri);
  const table = await db.openTable(TABLE_NAME);

  const results = await table.query()
    .where(`filePath = '${filePath.replace(/'/g, "''")}'`)
    .toArray();

  return results.map((row: Record<string, unknown>) => ({
    filePath: row.filePath as string,
    content: row.content as string,
    lineStart: row.lineStart as number,
    lineEnd: row.lineEnd as number,
    score: 1.0, // All chunks from same file have equal score
  }));
}

/**
 * Result of getFileContents
 */
export interface FileContentsResult {
  /** Full file content reconstructed from chunks */
  content: string;
  /** Individual chunks used to reconstruct */
  chunks: SearchResult[];
}

/**
 * Get complete file contents from indexed chunks
 * @param filePath - Path to file
 * @param dbUri - LanceDB URI (optional)
 * @returns File contents with chunks, or null if file not indexed
 */
export async function getFileContents(
  filePath: string,
  dbUri?: string
): Promise<FileContentsResult | null> {
  const uri = dbUri || process.env.LANCEDB_URI;
  if (!uri) {
    throw new Error('LanceDB URI not provided. Set dbUri parameter or LANCEDB_URI environment variable.');
  }

  const db = await lancedbPool.connect(uri);
  const table = await db.openTable(TABLE_NAME);

  // Query all chunks for this file
  const results = await table.query()
    .where(`filePath = '${filePath.replace(/'/g, "''")}'`)
    .toArray();

  if (results.length === 0) {
    return null;
  }

  // Sort by chunkIndex to maintain order
  const sortedChunks = results.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    (a.chunkIndex as number) - (b.chunkIndex as number)
  );

  // Concatenate all chunk contents
  const fullContent = sortedChunks
    .map((row) => row.content as string)
    .join('');

  const chunks: SearchResult[] = sortedChunks.map((row: Record<string, unknown>) => ({
    filePath: row.filePath as string,
    content: row.content as string,
    lineStart: row.lineStart as number,
    lineEnd: row.lineEnd as number,
    score: 1.0,
  }));

  return { content: fullContent, chunks };
}