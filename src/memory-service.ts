import { getMemorySystem, MemorySystem } from './memory/index.js';
import { searchProject } from './project-index/search.js';
import { ProjectIndexer } from './project-index/indexer.js';
import { protocolTracker } from './protocol/tracker.js';

export interface MemoryQueryOptions {
  limit?: number;
  strategy?: 'tiered' | 'vector_only' | 'text_only';
  threshold?: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface ProjectChunk {
  filePath: string;
  content: string;
  lineStart?: number;
  lineEnd?: number;
  score?: number;
}

export class MemoryService {
  private memorySystem: MemorySystem;
  private initialized = false;
  private activeIndexer: ProjectIndexer | null = null;
  private fallbackMode = false;

  constructor() {
    this.memorySystem = getMemorySystem();
  }

  async initialize(dbUri?: string): Promise<void> {
    if (this.initialized || this.fallbackMode) return;
    try {
      await this.memorySystem.initialize(dbUri);
      this.initialized = true;
    } catch (error) {
      console.warn('[MemoryService] Initialization failed, entering fallback mode:', error instanceof Error ? error.message : error);
      this.fallbackMode = true;
    }
  }

  isInitialized(): boolean {
    return this.initialized || this.fallbackMode;
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  async queryMemories(query: string, options: MemoryQueryOptions = {}): Promise<MemoryEntry[]> {
    if (this.fallbackMode) {
      console.warn('[MemoryService] Fallback mode: returning empty results for query');
      return [];
    }
    protocolTracker.recordToolCall('system', 'memory.queryMemories', { query, options });
    this.ensureInitialized();
    const results = await this.memorySystem.search(query, {
      topK: options.limit ?? 10,
      strategy: (options.strategy ?? 'TIERED').toUpperCase() as any,
      threshold: options.threshold ?? 0.7,
    });
    return results.map(r => ({
      id: r.entry.id,
      content: r.entry.text,
      score: r.score,
      metadata: r.entry.metadataJson ? JSON.parse(r.entry.metadataJson) : {},
    }));
  }

  async addMemory(entry: {
    content: string;
    sourceType?: 'file' | 'conversation' | 'manual' | 'web';
    sourcePath?: string;
    metadata?: Record<string, unknown>;
    sessionId?: string;
  }): Promise<{ id: string }> {
    if (this.fallbackMode) {
      console.warn('[MemoryService] Fallback mode: not saving memory');
      return { id: 'fallback-' + Date.now() };
    }
    protocolTracker.recordToolCall('system', 'memory.addMemory', { content: entry.content.slice(0, 100) });
    this.ensureInitialized();
    const result = await this.memorySystem.addMemory({
      text: entry.content,
      sourceType: entry.sourceType ?? 'manual',
      sourcePath: entry.sourcePath ?? '',
      sessionId: entry.sessionId ?? 'default',
      metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : '{}',
    });
    return { id: result.id };
  }

  async searchProject(query: string, topK: number = 10): Promise<ProjectChunk[]> {
    if (this.fallbackMode) {
      return [];
    }
    protocolTracker.recordToolCall('system', 'memory.searchProject', { query, topK });
    const results = await searchProject(query, topK);
    return results.map(r => ({
      filePath: r.filePath,
      content: r.content,
      lineStart: r.lineStart,
      lineEnd: r.lineEnd,
      score: r.score,
    }));
  }

  async indexProject(rootPath: string, dbUri?: string): Promise<void> {
    if (this.fallbackMode) {
      console.warn('[MemoryService] Fallback mode: skipping project indexing');
      return;
    }
    protocolTracker.recordToolCall('system', 'memory.indexProject', { rootPath });
    const indexer = new ProjectIndexer(dbUri ?? 'memory://', rootPath);
    await indexer.start();
    this.activeIndexer = indexer;
  }

  private ensureInitialized(): void {
    if (!this.initialized && !this.fallbackMode) {
      throw new Error('MemoryService not initialized. Call initialize() first.');
    }
  }
}

let serviceInstance: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!serviceInstance) {
    serviceInstance = new MemoryService();
  }
  return serviceInstance;
}