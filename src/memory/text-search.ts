/**
 * Fuse.js wrapper for text-based memory search
 */

import Fuse from 'fuse.js';
import type { MemoryEntry, SearchResult } from './schema.js';

/** Fuse.js index cached in memory */
let fuseIndex: Fuse<MemoryEntry> | null = null;

/**
 * Text search engine using Fuse.js
 */
export class TextSearch {
  private memories: MemoryEntry[] = [];

  /**
   * Create a TextSearch instance
   * @param memories - Array of memory entries to search
   */
  constructor(memories: MemoryEntry[]) {
    this.memories = memories;
  }

  /**
   * Create a Fuse.js index from memory entries
   */
  createIndex(memories: MemoryEntry[]): Fuse<MemoryEntry> {
    this.memories = memories;
    fuseIndex = new Fuse(memories, {
      threshold: 0.3,
      distance: 100,
      ignoreLocation: true,
      keys: ['text', 'sourcePath'],
    });
    return fuseIndex;
  }

  /**
   * Search using Fuse.js index
   */
  search(query: string): SearchResult<MemoryEntry>[] {
    if (!fuseIndex) {
      fuseIndex = this.createIndex(this.memories);
    }

    const results = fuseIndex.search(query);
    return results.map((result) => ({
      entry: result.item,
      // Fuse.js score: lower = better, convert to similarity (higher = better)
      score: 1 - (result.score ?? 0),
    }));
  }

  /**
   * Refresh the Fuse.js index
   */
  async refreshIndex(): Promise<void> {
    fuseIndex = this.createIndex(this.memories);
  }

  /**
   * Get cached index or create new one
   */
  getIndex(): Fuse<MemoryEntry> | null {
    return fuseIndex;
  }
}

/**
 * Clear the cached Fuse index
 */
export function clearTextSearchCache(): void {
  fuseIndex = null;
}
