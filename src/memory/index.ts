/**
 * MemorySystem - Singleton wrapper for memory CRUD operations
 * 
 * Phase 1: Wraps Super-Memory-TS MemorySystem while preserving the original API surface.
 */

import { MemorySystem as SmtMemorySystem, getMemorySystem as getSmtMemorySystem } from '@veedubin/super-memory-ts/dist/memory/index.js';
import type { MemoryEntry, SourceType, SearchResult, SearchOptions } from './schema.js';
import { DEFAULT_SEARCH_OPTIONS } from './schema.js';
import { adaptMemoryEntry, toSmtMemoryEntryInput } from './adapter.js';

const PROJECT_ID = process.env.BOOMERANG_PROJECT_ID || 'boomerang-default';

class MemorySystem {
  private static instance: MemorySystem | null = null;
  private _initialized: boolean = false;
  private _smt: SmtMemorySystem;

  private constructor() {
    this._smt = getSmtMemorySystem({ projectId: PROJECT_ID });
  }

  /**
   * Get the MemorySystem singleton instance
   */
  static getInstance(): MemorySystem {
    if (!MemorySystem.instance) {
      MemorySystem.instance = new MemorySystem();
    }
    return MemorySystem.instance;
  }

  /**
   * Check if the system has been initialized
   */
  isInitialized(): boolean {
    return this._initialized || this._smt.isInitialized();
  }

  /**
   * Initialize the memory system with an optional database URI
   * Prevents multiple initialization calls
   */
  async initialize(dbUri?: string): Promise<void> {
    if (this._initialized) {
      throw new Error('MemorySystem already initialized. Use isInitialized() to check state.');
    }
    await this._smt.initialize(dbUri);
    this._initialized = true;
  }

  /**
   * Add a new memory entry
   */
  async addMemory(
    entry: Omit<MemoryEntry, 'id' | 'vector' | 'timestamp' | 'contentHash'>
  ): Promise<MemoryEntry> {
    this.ensureInitialized();
    
    const input = toSmtMemoryEntryInput(entry);
    const id = await this._smt.addMemory(input);
    
    // Retrieve the full entry to return the complete MemoryEntry
    const smtEntry = await this._smt.getMemory(id);
    if (!smtEntry) {
      throw new Error(`Memory added but could not be retrieved: ${id}`);
    }
    return adaptMemoryEntry(smtEntry);
  }

  /**
   * Get a memory entry by ID
   */
  async getMemory(id: string): Promise<MemoryEntry | null> {
    this.ensureInitialized();
    const entry = await this._smt.getMemory(id);
    return entry ? adaptMemoryEntry(entry) : null;
  }

  /**
   * Delete a memory entry by ID
   */
  async deleteMemory(id: string): Promise<boolean> {
    this.ensureInitialized();
    try {
      await this._smt.deleteMemory(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List unique source paths, optionally filtered by source type
   */
  async listSources(sourceType?: SourceType): Promise<string[]> {
    this.ensureInitialized();
    const entries = await this._smt.listMemories();
    const pathSet = new Set<string>();
    
    for (const entry of entries) {
      if (entry.sourcePath && (!sourceType || entry.sourceType === sourceType)) {
        pathSet.add(entry.sourcePath);
      }
    }
    
    return Array.from(pathSet);
  }

  /**
   * Save a context entry for a session
   */
  async saveContext(sessionId: string, context: string): Promise<MemoryEntry> {
    this.ensureInitialized();
    return this.addMemory({
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
  async getContext(sessionId: string): Promise<MemoryEntry | null> {
    this.ensureInitialized();
    const entries = await this._smt.queryMemories(`session:${sessionId}`, {
      topK: 100,
      filter: { sessionId },
    });
    
    // Find the most recent context entry
    let latestContext: MemoryEntry | null = null;
    for (const entry of entries) {
      const entryTimestamp = entry.timestamp instanceof Date ? entry.timestamp.getTime() : entry.timestamp;
      if (entry.metadataJson) {
        try {
          const meta = JSON.parse(entry.metadataJson);
          if (meta.type === 'context') {
            if (!latestContext || entryTimestamp > latestContext.timestamp) {
              latestContext = adaptMemoryEntry(entry);
            }
          }
        } catch {
          // Not a context entry
        }
      }
    }
    
    return latestContext;
  }

  /**
   * Search memories using query string with optional search options
   */
  async search(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult<MemoryEntry>[]> {
    this.ensureInitialized();
    
    const opts = {
      ...DEFAULT_SEARCH_OPTIONS,
      ...options,
    };
    
    const smtResults = await this._smt.queryMemories(query, opts);
    
    return smtResults.map(entry => ({
      entry: adaptMemoryEntry(entry),
      score: entry.score ?? 0,
    }));
  }

  /**
   * Ensure the system is initialized before performing operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('MemorySystem not initialized. Call initialize() first.');
    }
  }
}

/**
 * Factory function to get the MemorySystem singleton
 */
export function getMemorySystem(): MemorySystem {
  return MemorySystem.getInstance();
}

export { MemorySystem };