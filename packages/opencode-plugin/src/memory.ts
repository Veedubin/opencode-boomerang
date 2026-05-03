/**
 * Boomerang Memory v4.0.0 - Direct Integration with Super-Memory-TS
 * 
 * Uses direct imports from @veedubin/super-memory-ts (no MCP).
 * All memory operations are direct function calls.
 */

import { MemorySystem as SmtMemorySystem, getMemorySystem as getSmtMemorySystem } from '@veedubin/super-memory-ts/dist/memory/index.js';
import type { MemoryEntry, SearchOptions } from './types.js';

const PROJECT_ID = process.env.BOOMERANG_PROJECT_ID || 'boomerang-plugin';

class PluginMemorySystem {
  private static instance: PluginMemorySystem | null = null;
  private _initialized: boolean = false;
  private _smt: SmtMemorySystem;

  private constructor() {
    this._smt = getSmtMemorySystem({ projectId: PROJECT_ID });
  }

  static getInstance(): PluginMemorySystem {
    if (!PluginMemorySystem.instance) {
      PluginMemorySystem.instance = new PluginMemorySystem();
    }
    return PluginMemorySystem.instance;
  }

  isInitialized(): boolean {
    return this._initialized || this._smt.isInitialized();
  }

  async initialize(dbUri?: string): Promise<void> {
    if (this._initialized) {
      return;
    }
    await this._smt.initialize(dbUri);
    this._initialized = true;
  }

  async search(query: string, options?: Partial<SearchOptions>): Promise<{ entry: MemoryEntry; score: number }[]> {
    this.ensureInitialized();
    
    const topK = options?.topK || 10;
    const smtResults = await this._smt.queryMemories(query, { topK });
    
    return smtResults.map((result) => ({
      entry: {
        id: result.id,
        text: result.text,
        sourceType: result.sourceType as MemoryEntry['sourceType'],
        sourcePath: result.sourcePath || '',
        timestamp: result.timestamp instanceof Date ? result.timestamp.getTime() : result.timestamp,
        metadataJson: result.metadataJson || '{}',
      },
      score: result.score ?? 0,
    }));
  }

  async addMemory(entry: Partial<MemoryEntry>): Promise<MemoryEntry> {
    this.ensureInitialized();
    const input = {
      text: entry.text || '',
      sourceType: entry.sourceType || 'boomerang',
      sourcePath: entry.sourcePath || '',
      metadataJson: entry.metadataJson || '{}',
      sessionId: entry.sessionId || '',
    };
    const id = await this._smt.addMemory(input);
    const smtEntry = await this._smt.getMemory(id);
    if (!smtEntry) {
      throw new Error(`Memory added but could not be retrieved: ${id}`);
    }
    return {
      id: smtEntry.id,
      text: smtEntry.text,
      sourceType: smtEntry.sourceType,
      sourcePath: smtEntry.sourcePath || '',
      timestamp: smtEntry.timestamp instanceof Date ? smtEntry.timestamp.getTime() : smtEntry.timestamp,
      metadataJson: smtEntry.metadataJson || '{}',
    };
  }

  async saveContext(sessionId: string, context: string): Promise<MemoryEntry> {
    return this.addMemory({
      text: context,
      sourceType: 'session',
      sourcePath: `session://${sessionId}`,
      metadataJson: JSON.stringify({ type: 'context' }),
      sessionId,
    });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('PluginMemorySystem not initialized. Call initialize() first.');
    }
  }
}

let memoryInstance: PluginMemorySystem | null = null;

export function getMemorySystem(): PluginMemorySystem {
  if (!memoryInstance) {
    memoryInstance = PluginMemorySystem.getInstance();
  }
  return memoryInstance;
}

export { PluginMemorySystem };
