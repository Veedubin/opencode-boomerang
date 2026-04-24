/**
 * Memory search engine with multi-strategy support
 */

import type { MemoryEntry, SearchResult, SearchOptions, SearchStrategy } from './schema.js';
import { DEFAULT_SEARCH_OPTIONS } from './schema.js';
import { lancedbPool } from './database.js';
import { modelManager } from '../model/index.js';
import { SUPPORTED_MODELS } from '../model/types.js';
import { TextSearch } from './text-search.js';

const MEMORY_TABLE = 'memory_entries';

/**
 * Memory search engine supporting multiple strategies:
 * - TIERED: Vector search with Fuse.js fallback
 * - VECTOR_ONLY: Pure vector search
 * - TEXT_ONLY: Pure Fuse.js search
 */
export class MemorySearch {
  private db: typeof lancedbPool;

  /**
   * Create a MemorySearch instance
   * @param db - LanceDB connection pool instance
   */
  constructor(db: typeof lancedbPool) {
    this.db = db;
  }

  /**
   * Perform a search using the specified strategy
   */
  async search(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult<MemoryEntry>[]> {
    const opts: SearchOptions = {
      ...DEFAULT_SEARCH_OPTIONS,
      ...options,
    };

    switch (opts.strategy) {
      case 'VECTOR_ONLY':
        return this.vectorSearch(query, opts);
      case 'TEXT_ONLY':
        return this.textOnlySearch(query, opts);
      case 'TIERED':
      default:
        return this.tieredSearch(query, opts);
    }
  }

  /**
   * TIERED strategy: vector search with Fuse.js fallback
   */
  private async tieredSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<MemoryEntry>[]> {
    // Step 1: Generate embedding
    await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);
    const embedding = await modelManager.generateEmbedding(query, SUPPORTED_MODELS.BGE_LARGE);

    // Step 2: Vector search
    const vectorResults = await this.vectorSearchInternal(embedding, options.topK * 2);

    // Step 3: Check if fallback needed
    const needsFallback =
      vectorResults.length < options.topK ||
      vectorResults.some((r) => r.score < 0.72);

    let textResults: SearchResult<MemoryEntry>[] = [];
    if (needsFallback) {
      textResults = await this.textSearch(query, options.topK * 2);
    }

    // Step 4: Merge and deduplicate
    const merged = this.mergeResults(vectorResults, textResults);

    // Step 5: Filter by threshold and return topK
    return merged
      .filter((r) => r.score >= options.threshold)
      .slice(0, options.topK);
  }

  /**
   * VECTOR_ONLY strategy: pure vector search
   */
  private async vectorSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<MemoryEntry>[]> {
    await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);
    const embedding = await modelManager.generateEmbedding(query, SUPPORTED_MODELS.BGE_LARGE);

    const results = await this.vectorSearchInternal(embedding, options.topK);

    return results
      .filter((r) => r.score >= options.threshold)
      .slice(0, options.topK);
  }

  /**
   * Internal vector search using LanceDB
   */
  private async vectorSearchInternal(
    embedding: number[],
    limit: number
  ): Promise<SearchResult<MemoryEntry>[]> {
    try {
      const connection = await this.db.connect('memory://');
      const table = await this.db.getTable('memory://', MEMORY_TABLE);

      // Use approximate nearest neighbors search
      const results = await table
        .query()
        .nearestTo(embedding)
        .limit(limit)
        .toArray();

      return results.map((row: Record<string, unknown>) => {
        const entry = row as unknown as MemoryEntry;
        // LanceDB returns _distance, convert to similarity score
        // Distance is euclidean, lower is better, so we invert
        const distance = (row._distance as number) ?? 0;
        const score = distance === 0 ? 1 : 1 / (1 + distance);

        return { entry, score };
      });
    } catch {
      return [];
    }
  }

  /**
   * TEXT_ONLY strategy: pure Fuse.js search
   */
  private async textOnlySearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<MemoryEntry>[]> {
    return this.textSearch(query, options.topK);
  }

  /**
   * Internal text search using Fuse.js
   */
  private async textSearch(
    query: string,
    limit: number
  ): Promise<SearchResult<MemoryEntry>[]> {
    try {
      const connection = await this.db.connect('memory://');
      const table = await this.db.getTable('memory://', MEMORY_TABLE);

      const allEntries = await table.query().limit(10000).toArray();
      const memories = allEntries as MemoryEntry[];

      const textSearch = new TextSearch(memories);
      const results = textSearch.search(query);

      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Merge results from multiple strategies, deduplicate by contentHash
   */
  private mergeResults(
    vectorResults: SearchResult<MemoryEntry>[],
    textResults: SearchResult<MemoryEntry>[]
  ): SearchResult<MemoryEntry>[] {
    const seen = new Map<string, SearchResult<MemoryEntry>>();

    // Add vector results first (higher priority)
    for (const result of vectorResults) {
      const hash = result.entry.contentHash;
      if (!seen.has(hash)) {
        seen.set(hash, result);
      }
    }

    // Add text results, keep higher score if duplicate
    for (const result of textResults) {
      const hash = result.entry.contentHash;
      const existing = seen.get(hash);
      if (!existing) {
        seen.set(hash, result);
      } else if (result.score > existing.score) {
        seen.set(hash, result);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Refresh the Fuse.js index cache
   */
  async refreshIndex(): Promise<void> {
    try {
      const connection = await this.db.connect('memory://');
      const table = await this.db.getTable('memory://', MEMORY_TABLE);

      const allEntries = await table.query().limit(10000).toArray();
      const memories = allEntries as MemoryEntry[];

      const textSearch = new TextSearch(memories);
      await textSearch.refreshIndex();
    } catch {
      // Silently fail if refresh fails
    }
  }
}

/**
 * Module-level search function that wraps MemorySearch
 */
export async function search(
  query: string,
  options?: Partial<SearchOptions>
): Promise<SearchResult<MemoryEntry>[]> {
  const memorySearch = new MemorySearch(lancedbPool);
  return memorySearch.search(query, options);
}
