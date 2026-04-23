/**
 * Built-in Memory Integration for Boomerang with Multi-Project Support
 *
 * Direct imports from Super-Memory-TS core modules (no MCP protocol).
 * Provides per-project memory database and project indexing.
 */

// Relative path from boomerang/.opencode/plugins/boomerang/src/ to Super-Memory-TS/src/
const SUPER_MEMORY_PATH = '../../../../../Super-Memory-TS/src';

// Local type definitions to avoid cross-project import issues
interface ProjectSearchResult {
  chunk: {
    id: string;
    filePath: string;
    content: string;
    chunkIndex: number;
    totalChunks: number;
    fileType: string;
    lineStart: number;
    lineEnd: number;
  };
  score: number;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

interface MemoryEntry {
  id: string;
  text: string;
  vector: Float32Array;
  sourceType: string;
  sourcePath?: string;
  timestamp: Date;
  contentHash: string;
  metadataJson?: string;
  sessionId?: string;
}

export interface ProjectMemoryConfig {
  memoryPath: string;
  indexPath: string;
  excludePatterns: string[];
  chunkSize: number;
  chunkOverlap?: number;
  maxFileSize?: number;
}

/**
 * Status of the built-in memory system
 */
export interface BuiltInMemoryStatus {
  indexedFiles: number;
  totalChunks: number;
  status: 'initializing' | 'running' | 'stopped' | 'error';
  modelLoaded: boolean;
  modelId?: string;
  error?: string;
}

/**
 * BuiltInMemory - Wraps Super-Memory-TS core for internal Boomerang use
 *
 * Provides per-project:
 * - Project file indexing with auto-start
 * - Memory search using embedded vectors
 * - Status reporting for indexing state
 */
export class BuiltInMemory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private indexer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private memoryDb: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private modelManager: any = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private projectPath: string = '';

  /**
   * Initialize the built-in memory system for a specific project
   */
  async initialize(projectPath: string, config: ProjectMemoryConfig): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.projectPath = projectPath;

    this.initPromise = (async () => {
      try {
        // Dynamic import to resolve at runtime
        const { createIndexer } = await import(`${SUPER_MEMORY_PATH}/project-index/index.js`);
        const { getDatabase } = await import(`${SUPER_MEMORY_PATH}/memory/index.js`);
        const { ModelManager } = await import(`${SUPER_MEMORY_PATH}/model/index.js`);
        const { generateEmbeddings } = await import(`${SUPER_MEMORY_PATH}/model/embeddings.js`);

        // Initialize ModelManager (singleton)
        this.modelManager = ModelManager.getInstance();
        await this.modelManager.acquire();

        // Initialize Memory Database at project-specific path
        this.memoryDb = getDatabase(config.memoryPath);
        await this.memoryDb.initialize();

        // Create and start Project Indexer
        this.indexer = createIndexer(
          {
            rootPath: projectPath,
            includePatterns: [
              '**/*.ts',
              '**/*.tsx',
              '**/*.js',
              '**/*.jsx',
              '**/*.py',
              '**/*.md',
              '**/*.json',
              '**/*.yaml',
              '**/*.yml',
            ],
            excludePatterns: config.excludePatterns.map(p => `**/${p}/**`),
            maxFileSize: config.maxFileSize || 1024 * 1024,
            chunkSize: config.chunkSize,
            chunkOverlap: config.chunkOverlap || 50,
          },
          this.memoryDb
        );

        // Store generateEmbeddings for use in instance methods
        (this as any)._generateEmbeddings = generateEmbeddings;

        // Start indexer in background (non-blocking)
        this.indexer.start().catch((err: unknown) => {
          console.error('Indexer start error:', err);
        });

        this.initialized = true;
        console.log(`BuiltInMemory initialized for project: ${projectPath}`);
      } catch (error) {
        console.error('Failed to initialize BuiltInMemory:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Search project files using semantic search
   */
  async searchProject(query: string, topK: number = 10): Promise<ProjectSearchResult[]> {
    if (!this.indexer) {
      throw new Error('Indexer not initialized. Call initialize() first.');
    }

    return this.indexer.search(query, { topK });
  }

  /**
   * Query memories from the database
   */
  async queryMemories(query: string, topK: number = 5): Promise<MemoryEntry[]> {
    if (!this.memoryDb) {
      throw new Error('Memory database not initialized. Call initialize() first.');
    }

    // Generate embedding for query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generateEmbeddings = (this as any)._generateEmbeddings as (texts: string[]) => Promise<Array<{ embedding: number[] }>>;
    const results = await generateEmbeddings([query]);
    const queryVector = new Float32Array(results[0].embedding);

    return this.memoryDb.queryMemories(queryVector, { topK });
  }

  /**
   * Add a memory entry
   */
  async addMemory(content: string, metadata?: Record<string, string>): Promise<string> {
    if (!this.memoryDb) {
      throw new Error('Memory database not initialized. Call initialize() first.');
    }

    // Generate embedding for content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generateEmbeddings = (this as any)._generateEmbeddings as (texts: string[]) => Promise<Array<{ embedding: number[] }>>;
    const results = await generateEmbeddings([content]);
    const embedding = new Float32Array(results[0].embedding);

    return this.memoryDb.addMemory({
      text: content,
      vector: embedding,
      sourceType: 'boomerang',
      metadataJson: metadata ? JSON.stringify(metadata) : '',
    });
  }

  /**
   * Get current status of the memory system
   */
  getStatus(): BuiltInMemoryStatus {
    const stats = this.indexer?.getStats();
    const modelMeta = this.modelManager?.getMetadata();

    return {
      indexedFiles: stats?.indexedFiles ?? 0,
      totalChunks: stats?.totalChunks ?? 0,
      status: this.initialized
        ? (this.indexer?.isIndexerRunning() ? 'running' : 'stopped')
        : 'initializing',
      modelLoaded: modelMeta?.isLoaded ?? false,
      modelId: modelMeta?.modelId,
    };
  }

  /**
   * Get the project path this memory instance is for
   */
  getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Stop the indexer
   */
  async shutdown(): Promise<void> {
    if (this.indexer) {
      await this.indexer.stop();
      this.indexer = null;
    }
    if (this.modelManager) {
      await this.modelManager.release();
    }
    if (this.memoryDb) {
      await this.memoryDb.close();
      this.memoryDb = null;
    }
    this.initialized = false;
    this.initPromise = null;
    this.projectPath = '';
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
