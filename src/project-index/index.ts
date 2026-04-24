/**
 * Project Index - File Chunking, Watching, Indexing, and Search
 */

// Types
export * from './types.js';

// Chunker
export { chunkFile } from './chunker.js';

// Watcher
export { createWatcher } from './watcher.js';

// Indexer
export { ProjectIndexer, createProjectIndexer } from './indexer.js';

// Search
export { searchProject, getFileChunks, type SearchResult } from './search.js';
