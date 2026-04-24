/**
 * ProjectIndexer - Background indexing engine with queue system
 * Handles file watching, incremental updates, and hash-based change detection
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import type { FSWatcher } from 'chokidar';
import type { Connection, Table } from '@lancedb/lancedb';

import { chunkFile } from './chunker.js';
import { createWatcher } from './watcher.js';
import { lancedbPool } from '../memory/database.js';
import { modelManager } from '../model/index.js';
import {
  type IndexConfig,
  type IndexerStats,
  type ProjectChunk,
  type FileChunk,
  type FileEvent,
  DEFAULT_INDEX_CONFIG,
} from './types.js';
import { SUPPORTED_MODELS } from '../model/types.js';

const TABLE_NAME = 'project_chunks';

/**
 * Compute SHA-256 hash of content
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate unique chunk ID
 */
function generateChunkId(filePath: string, chunkIndex: number): string {
  return `${filePath}:${chunkIndex}`;
}

/**
 * ProjectIndexer class manages background indexing with queue system
 */
export class ProjectIndexer {
  private dbUri: string;
  private rootPath: string;
  private config: Required<IndexConfig>;
  private watcher: FSWatcher | null = null;
  private db: Connection | null = null;
  private table: Table | null = null;

  // Queue system
  private pendingQueue: Set<string> = new Set();
  private activeOperations: Set<string> = new Set();
  private fileHashes: Map<string, string> = new Map();
  private stats: IndexerStats = {
    totalFiles: 0,
    totalChunks: 0,
    lastIndexed: null,
  };

  // Processing state
  private isProcessing = false;
  private isRunning = false;

  constructor(dbUri: string, rootPath: string, config?: Partial<IndexConfig>) {
    this.dbUri = dbUri;
    this.rootPath = rootPath;
    this.config = {
      dbUri,
      rootPath,
      chunkConfig: config?.chunkConfig ?? DEFAULT_INDEX_CONFIG.chunkConfig,
      watchConfig: config?.watchConfig ?? DEFAULT_INDEX_CONFIG.watchConfig,
      maxConcurrent: config?.maxConcurrent ?? DEFAULT_INDEX_CONFIG.maxConcurrent,
      embeddingModel: config?.embeddingModel ?? DEFAULT_INDEX_CONFIG.embeddingModel,
    };
  }

  /**
   * Start the indexer - initialize DB and watcher
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    // Connect to LanceDB
    this.db = await lancedbPool.connect(this.dbUri);

    // Ensure table exists
    await this.ensureTable();

    // Load embedding model
    await modelManager.loadModel(this.config.embeddingModel);

    // Create file watcher
    this.watcher = createWatcher(
      this.rootPath,
      this.config.watchConfig,
      (event: FileEvent) => this.handleFileEvent(event)
    );

    this.isRunning = true;
  }

  /**
   * Stop the indexer - close watcher and flush queue
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Stop watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Wait for queue to drain
    await this.flushQueue();

    // Close DB connection
    if (this.db) {
      await lancedbPool.close(this.dbUri);
      this.db = null;
    }

    this.table = null;
    this.isRunning = false;
  }

  /**
   * Index a single file
   */
  async indexFile(filePath: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Indexer not running. Call start() first.');
    }

    try {
      // Read file content
      const content = readFileSync(filePath, 'utf-8');
      const hash = computeHash(content);

      // Skip if file hasn't changed (using stored hash)
      const previousHash = this.fileHashes.get(filePath);
      if (previousHash === hash) {
        return; // Unchanged, skip
      }

      // Remove existing chunks for this file
      await this.removeFileInternal(filePath);

      // Chunk the file
      const chunks: FileChunk[] = chunkFile(filePath, content, this.config.chunkConfig);

      if (chunks.length === 0) {
        // Update hash even for empty/skip files
        this.fileHashes.set(filePath, hash);
        return;
      }

      // Generate embeddings and store chunks
      const records: ProjectChunk[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await modelManager.generateEmbedding(
          chunk.content,
          this.config.embeddingModel
        );

        records.push({
          id: generateChunkId(filePath, i),
          filePath,
          content: chunk.content,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
          chunkIndex: chunk.index,
          fileHash: hash,
          embedding,
          indexedAt: Date.now(),
        });
      }

      // Store in LanceDB
      if (this.table && records.length > 0) {
        await this.table.add(records as unknown as Record<string, unknown>[]);
      }

      // Update tracking
      this.fileHashes.set(filePath, hash);
      this.stats.totalFiles++;
      this.stats.totalChunks += chunks.length;
      this.stats.lastIndexed = new Date();

    } catch (err) {
      console.error(`Failed to index file ${filePath}:`, err);
      throw err;
    }
  }

  /**
   * Remove a file from the index
   */
  async removeFile(filePath: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Indexer not running. Call start() first.');
    }

    await this.removeFileInternal(filePath);
    this.fileHashes.delete(filePath);
  }

  /**
   * Internal remove without hash cleanup
   */
  private async removeFileInternal(filePath: string): Promise<void> {
    if (!this.table) return;

    try {
      // Delete all chunks for this file using SQL predicate
      // Escape single quotes in filePath to prevent SQL injection
      const escapedPath = filePath.replace(/'/g, "''");
      await this.table.delete(`filePath = '${escapedPath}'`);

      // Note: We don't know exact chunk count without querying first
      // The stats will be eventually consistent
    } catch (err) {
      console.error(`Failed to remove file ${filePath} from index:`, err);
    }
  }

  /**
   * Get indexer statistics
   */
  getStats(): IndexerStats {
    return { ...this.stats };
  }

  /**
   * Handle file system events from watcher
   */
  private handleFileEvent(event: FileEvent): void {
    switch (event.type) {
      case 'add':
        this.queueFile(event.filePath, 'add');
        break;
      case 'change':
        this.queueFile(event.filePath, 'change');
        break;
      case 'unlink':
        this.removeFile(event.filePath).catch(err => {
          console.error(`Failed to handle unlink for ${event.filePath}:`, err);
        });
        break;
    }
  }

  /**
   * Add file to processing queue
   */
  private queueFile(filePath: string, _operation: 'add' | 'change'): void {
    this.pendingQueue.add(filePath);
    this.processQueue();
  }

  /**
   * Process queued files in background with concurrency limit
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.pendingQueue.size > 0) {
        // Wait if at concurrent limit
        while (this.activeOperations.size >= this.config.maxConcurrent) {
          await this.waitForSlot();
        }

        // Get next file from queue
        const filePath = this.pendingQueue.values().next().value;
        if (!filePath) break;

        this.pendingQueue.delete(filePath);
        this.activeOperations.add(filePath);

        // Process in background (don't await)
        this.processFile(filePath)
          .finally(() => {
            this.activeOperations.delete(filePath);
            this.processQueue(); // Continue processing
          })
          .catch(err => {
            console.error(`Failed to process file ${filePath}:`, err);
          });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string): Promise<void> {
    await this.indexFile(filePath);
  }

  /**
   * Wait for an active operation to complete
   */
  private waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this.activeOperations.size < this.config.maxConcurrent) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Flush pending queue (wait for all operations to complete)
   */
  private async flushQueue(): Promise<void> {
    while (this.pendingQueue.size > 0 || this.activeOperations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Ensure project_chunks table exists with proper schema
   */
  private async ensureTable(): Promise<void> {
    if (!this.db) return;

    try {
      this.table = await this.db.openTable(TABLE_NAME);
    } catch {
      // Table doesn't exist, create it
      const schema = {
        vectorSchemas: {
          0: {
            vector: this.config.embeddingModel === SUPPORTED_MODELS.BGE_LARGE ? 1024 : 384,
          },
        },
      };

      this.table = await this.db.createTable(TABLE_NAME, [], schema as Record<string, unknown>);
    }
  }
}

/**
 * Factory function to create a ProjectIndexer
 */
export function createProjectIndexer(
  dbUri: string,
  rootPath: string,
  config?: Partial<IndexConfig>
): ProjectIndexer {
  return new ProjectIndexer(dbUri, rootPath, config);
}