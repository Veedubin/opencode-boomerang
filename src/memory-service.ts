import { getMemorySystem, MemorySystem } from './memory/index.js';
import { ProjectIndexer, createIndexer } from '@veedubin/super-memory-ts/dist/project-index/indexer.js';
import { getDatabase } from '@veedubin/super-memory-ts/dist/memory/database.js';
import { readFile } from 'fs/promises';

// Qdrant default URL
const DEFAULT_QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

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
  private dbUri: string = DEFAULT_QDRANT_URL;

  constructor() {
    this.memorySystem = getMemorySystem();
  }

  async initialize(dbUri?: string): Promise<void> {
    if (this.initialized || this.fallbackMode) return;
    try {
      // Use provided dbUri or default to Qdrant URL
      this.dbUri = dbUri || DEFAULT_QDRANT_URL;
      await this.memorySystem.initialize(this.dbUri);
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
    // Tool call tracking handled by ProtocolStateMachine checkpoints in v4.0
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
    // Tool call tracking handled by ProtocolStateMachine checkpoints in v4.0
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
    // Tool call tracking handled by ProtocolStateMachine checkpoints in v4.0
    if (!this.activeIndexer) {
      console.warn('[MemoryService] No active indexer - call indexProject first');
      return [];
    }
    const results = await this.activeIndexer.search(query, { topK });
    return results.map((r: { filePath: string; chunk: { content: string }; lineStart?: number; lineEnd?: number; score?: number }) => ({
      filePath: r.filePath,
      content: r.chunk.content,
      lineStart: r.lineStart,
      lineEnd: r.lineEnd,
      score: r.score,
    }));
  }

  /**
   * Get complete file contents, trying index first then disk fallback
   */
  async getFileContents(filePath: string): Promise<{ content: string; source: 'index' | 'disk'; chunks?: ProjectChunk[] } | null> {
    // Tool call tracking handled by ProtocolStateMachine checkpoints in v4.0

    // Try indexed version first
    if (!this.fallbackMode && this.activeIndexer) {
      const indexed = await this.activeIndexer.getFileContents(filePath);
      if (indexed) {
        return {
          content: indexed.content,
          source: 'index',
          chunks: indexed.chunks.map((c: { filePath: string; content: string; lineStart?: number; lineEnd?: number }) => ({
            filePath: c.filePath,
            content: c.content,
            lineStart: c.lineStart,
            lineEnd: c.lineEnd,
            score: 1.0,
          })),
        };
      }
    }

    // Fallback to disk read
    try {
      const content = await readFile(filePath, 'utf-8');
      return { content, source: 'disk' };
    } catch {
      return null;
    }
  }

  async indexProject(rootPath: string, dbUri?: string): Promise<void> {
    if (this.fallbackMode) {
      console.warn('[MemoryService] Fallback mode: skipping project indexing');
      return;
    }
    // Tool call tracking handled by ProtocolStateMachine checkpoints in v4.0

    // Use provided dbUri or the initialized one
    const targetUri = dbUri || this.dbUri;

    // Get database from Super-Memory-TS
    const db = getDatabase();

    // Create indexer with proper config (all required fields)
    const indexer = createIndexer(
      {
        rootPath,
        includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.md'],
        excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.log', '**/.cache/**'],
        maxFileSize: 1024 * 1024,
        chunkSize: 512,
        chunkOverlap: 50,
      },
      db,
      targetUri
    );

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