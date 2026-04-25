import { getMemorySystem, MemorySystem } from './memory/index.js';
import { searchProject } from './project-index/search.js';
import { ProjectIndexer } from './project-index/indexer.js';

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

  constructor() {
    this.memorySystem = getMemorySystem();
  }

  async initialize(dbUri?: string): Promise<void> {
    if (this.initialized) return;
    await this.memorySystem.initialize(dbUri);
    this.initialized = true;
  }

  async queryMemories(query: string, options: MemoryQueryOptions = {}): Promise<MemoryEntry[]> {
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
    const indexer = new ProjectIndexer(dbUri ?? 'memory://', rootPath);
    await indexer.start();
    this.activeIndexer = indexer;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
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