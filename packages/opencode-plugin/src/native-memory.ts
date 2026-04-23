import { MemoryEngine, memoryEngine } from './memory-engine.js';

export class NativeBoomerangMemory {
  private engine: MemoryEngine;
  constructor(engine: MemoryEngine = memoryEngine) { this.engine = engine; }

  async addMemory(content: string, tags?: string[], metadata?: Record<string, any>): Promise<any> {
    return this.engine.call('add', { content, tags, metadata });
  }

  async searchMemory(query: string, limit = 5): Promise<any> {
    return this.engine.call('search', { query, limit });
  }
}

export const boomerangMemory = new NativeBoomerangMemory();