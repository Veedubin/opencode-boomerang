/**
 * Memory entry and search types for LanceDB storage
 */

export type SourceType = 'file' | 'conversation' | 'manual' | 'web';

export interface MemoryEntry {
  /** Unique identifier (UUID) */
  id: string;
  /** Raw text content */
  text: string;
  /** 1024-dimensional embedding vector */
  vector: number[];
  /** Origin of the memory */
  sourceType: SourceType;
  /** File path or URL or conversation ID */
  sourcePath: string;
  /** Creation timestamp */
  timestamp: number;
  /** SHA-256 hash of content */
  contentHash: string;
  /** JSON-serialized metadata */
  metadataJson: string;
  /** Associated session ID */
  sessionId: string;
  /** Similarity score from search (populated when returned from search) */
  score?: number;
  /** Project ID for multi-tenant isolation */
  projectId?: string;
}

export interface ProjectChunk {
  /** Unique identifier (UUID) */
  id: string;
  /** Source file path */
  filePath: string;
  /** Text content of chunk */
  content: string;
  /** 1024-dimensional embedding vector */
  vector: number[];
  /** Position in sorted chunk sequence */
  chunkIndex: number;
  /** Starting line number (1-indexed) */
  lineStart: number;
  /** Ending line number (inclusive) */
  lineEnd: number;
  /** SHA-256 hash of full file content */
  contentHash: string;
  /** Creation timestamp */
  timestamp: number;
}

export interface SearchResult<T = MemoryEntry | ProjectChunk> {
  /** The found entry */
  entry: T;
  /** Similarity score (higher = better) */
  score: number;
}

export type SearchStrategy = 'TIERED' | 'VECTOR_ONLY' | 'TEXT_ONLY';

export interface SearchOptions {
  /** Search strategy to use */
  strategy: SearchStrategy;
  /** Maximum results to return */
  topK: number;
  /** Minimum similarity score threshold */
  threshold: number;
}

/** Default search options */
export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  strategy: 'TIERED',
  topK: 10,
  threshold: 0.7,
};
