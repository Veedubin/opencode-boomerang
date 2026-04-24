/**
 * MemorySystem - Singleton wrapper for memory CRUD operations
 */

import type { MemoryEntry, SourceType, SearchResult, SearchOptions } from './schema.js';
import * as operations from './operations.js';
import { lancedbPool } from './database.js';
import { MemorySearch } from './search.js';

class MemorySystem {
  private static instance: MemorySystem | null = null;
  private _initialized: boolean = false;
  private _dbUri: string = 'memory://';
  private _search: MemorySearch | null = null;

  private constructor() {}

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
    return this._initialized;
  }

  /**
   * Initialize the memory system with an optional database URI
   * Prevents multiple initialization calls
   */
  async initialize(dbUri?: string): Promise<void> {
    if (this._initialized) {
      throw new Error('MemorySystem already initialized. Use isInitialized() to check state.');
    }

    if (dbUri) {
      this._dbUri = dbUri;
    }

    // Pre-connect to establish the connection pool
    await lancedbPool.connect(this._dbUri);
    this._initialized = true;
  }

  /**
   * Add a new memory entry
   */
  async addMemory(
    entry: Omit<MemoryEntry, 'id' | 'vector' | 'timestamp' | 'contentHash'>
  ): Promise<MemoryEntry> {
    this.ensureInitialized();
    return operations.addMemory(entry);
  }

  /**
   * Get a memory entry by ID
   */
  async getMemory(id: string): Promise<MemoryEntry | null> {
    this.ensureInitialized();
    return operations.getMemory(id);
  }

  /**
   * Delete a memory entry by ID
   */
  async deleteMemory(id: string): Promise<boolean> {
    this.ensureInitialized();
    return operations.deleteMemory(id);
  }

  /**
   * List unique source paths, optionally filtered by source type
   */
  async listSources(sourceType?: SourceType): Promise<string[]> {
    this.ensureInitialized();
    return operations.listSources(sourceType);
  }

  /**
   * Save a context entry for a session
   */
  async saveContext(sessionId: string, context: string): Promise<MemoryEntry> {
    this.ensureInitialized();
    return operations.saveContext(sessionId, context);
  }

  /**
   * Get the most recent context entry for a session
   */
  async getContext(sessionId: string): Promise<MemoryEntry | null> {
    this.ensureInitialized();
    return operations.getContext(sessionId);
  }

  /**
   * Search memories using query string with optional search options
   */
  async search(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult<MemoryEntry>[]> {
    this.ensureInitialized();
    if (!this._search) {
      this._search = new MemorySearch(lancedbPool);
    }
    return this._search.search(query, options);
  }

  /**
   * Ensure the system is initialized before performing operations
   */
  private ensureInitialized(): void {
    if (!this._initialized) {
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
