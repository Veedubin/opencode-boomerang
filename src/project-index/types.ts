/**
 * Types for Project Indexing - File Chunking and Watching
 */

// Chunking configuration
export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 512,
  chunkOverlap: 50,
};

// A chunk of a file with line number metadata
export interface FileChunk {
  content: string;
  lineStart: number;
  lineEnd: number;
  index: number;
}

// File system event types
export type FileEventType = 'add' | 'change' | 'unlink';

export interface FileEvent {
  type: FileEventType;
  filePath: string;
}

// Watcher configuration
export interface WatchConfig {
  include: string[];
  exclude: string[];
  debounceMs: number;
}

export const DEFAULT_WATCH_CONFIG: WatchConfig = {
  include: ['**/*'],
  exclude: ['node_modules', '.git', 'dist', 'build', '*.lock', '.DS_Store'],
  debounceMs: 300,
};

// Indexer configuration
export interface IndexConfig {
  /** LanceDB URI for storage */
  dbUri: string;
  /** Root path to index */
  rootPath: string;
  /** Chunking configuration */
  chunkConfig: ChunkConfig;
  /** Watcher configuration */
  watchConfig: WatchConfig;
  /** Maximum concurrent indexing operations */
  maxConcurrent: number;
  /** Embedding model to use */
  embeddingModel: string;
}

export const DEFAULT_INDEX_CONFIG: Omit<IndexConfig, 'dbUri' | 'rootPath'> = {
  chunkConfig: DEFAULT_CHUNK_CONFIG,
  watchConfig: DEFAULT_WATCH_CONFIG,
  maxConcurrent: 5,
  embeddingModel: 'BAAI/bge-large-en-v1.5',
};

// Project chunk stored in LanceDB
export interface ProjectChunk {
  /** Unique chunk ID */
  id: string;
  /** File path */
  filePath: string;
  /** Chunk content */
  content: string;
  /** Start line (1-indexed) */
  lineStart: number;
  /** End line (1-indexed) */
  lineEnd: number;
  /** Chunk index within file */
  chunkIndex: number;
  /** File hash for change detection */
  fileHash: string;
  /** Chunk embedding vector */
  embedding: number[];
  /** When this chunk was indexed */
  indexedAt: number;
}

// Indexer statistics
export interface IndexerStats {
  totalFiles: number;
  totalChunks: number;
  lastIndexed: Date | null;
}
