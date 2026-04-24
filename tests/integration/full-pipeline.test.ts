/**
 * End-to-end integration tests for full pipeline
 * Test: index project → add memory → query → search project
 */

import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

// Use vi.hoisted for proper hoisting of mocks
const { mockModelManager, mockTable, mockConnection, mockConnect } = vi.hoisted(() => {
  const mockTable = {
    add: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      nearest: vi.fn().mockReturnThis(),
      nearestTo: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
  };

  const mockConnection = {
    createTable: vi.fn().mockResolvedValue({}),
    openTable: vi.fn().mockResolvedValue(mockTable),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnect = vi.fn().mockResolvedValue(mockConnection);

  const mockModelManager = {
    loadModel: vi.fn().mockResolvedValue({}),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    getPipeline: vi.fn().mockReturnValue(null),
  };

  return { mockModelManager, mockTable, mockConnection, mockConnect };
});

// Set up mocks before importing modules
vi.mock('../../src/model/index.js', () => ({
  modelManager: mockModelManager,
}));

vi.mock('@lancedb/lancedb', () => ({
  connect: mockConnect,
  Index: {
    ivfFlat: vi.fn().mockReturnValue({}),
  },
}));

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('Full Pipeline Integration', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = `${tmpdir()}/pipeline-test-${Date.now()}-${Math.random()}`;
    require('fs').mkdirSync(testDir, { recursive: true });
    dbPath = path.join(testDir, 'pipeline.db');
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('project indexing pipeline', () => {
    test('indexer initializes correctly', async () => {
      const { ProjectIndexer } = await import('../../src/project-index/indexer');

      const indexer = new ProjectIndexer(dbPath, testDir);
      expect(indexer).toBeDefined();
      expect(indexer.getStats()).toEqual({
        totalFiles: 0,
        totalChunks: 0,
        lastIndexed: null,
      });
    });

    test('indexer start/stop lifecycle works', async () => {
      const { ProjectIndexer } = await import('../../src/project-index/indexer');

      const indexer = new ProjectIndexer(dbPath, testDir);
      await indexer.start();
      expect(indexer.getStats().lastIndexed).toBeNull();
      await indexer.stop();
    });

    test('indexFile creates chunks for file', async () => {
      const { ProjectIndexer } = await import('../../src/project-index/indexer');

      const indexer = new ProjectIndexer(dbPath, testDir);
      await indexer.start();

      const tsFile = path.join(testDir, 'test.ts');
      writeFileSync(tsFile, `export function hello() {
  console.log('Hello World');
}

export const greeting = 'Hi there';`);

      await indexer.indexFile(tsFile);

      const stats = indexer.getStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalChunks).toBeGreaterThan(0);

      await indexer.stop();
    });

    test('indexer handles file with no semantic boundaries', async () => {
      const { ProjectIndexer } = await import('../../src/project-index/indexer');

      const indexer = new ProjectIndexer(dbPath, testDir);
      await indexer.start();

      const randomFile = path.join(testDir, 'random.txt');
      writeFileSync(randomFile, `))))(((
[][][][]
{{{{}}}}
@@@@@@@@`);

      await indexer.indexFile(randomFile);

      const stats = indexer.getStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalChunks).toBeGreaterThan(0);

      await indexer.stop();
    });
  });

  describe('memory operations pipeline', () => {
    test('addMemory with embedding generation', async () => {
      const { addMemory } = await import('../../src/memory/operations');
      const { lancedbPool } = await import('../../src/memory/database');

      await lancedbPool.connect('memory://test-embed');

      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const entry = await addMemory({
        text: 'This is a test memory with important information',
        sourceType: 'manual',
        sourcePath: '/test/source',
        metadataJson: JSON.stringify({ priority: 'high' }),
        sessionId: 'test-session',
      });

      expect(entry.id).toBeDefined();
      expect(entry.vector).toHaveLength(1024);
      expect(entry.contentHash).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    test('multiple memories maintain separate identities', async () => {
      const { addMemory } = await import('../../src/memory/operations');
      const { lancedbPool } = await import('../../src/memory/database');

      await lancedbPool.connect('memory://test-multiple');

      let callCount = 0;
      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) return []; // Duplicate check returns empty
          return [{ ...entry2 }]; // Get by ID returns entry2
        }),
      });

      const entry1 = await addMemory({
        text: 'First memory entry',
        sourceType: 'manual',
        sourcePath: '/source1',
        metadataJson: '{}',
        sessionId: 'session1',
      });

      // Reset call count for next memory
      callCount = 0;
      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) return [];
          return [{ ...entry1 }];
        }),
      });

      const entry2 = await addMemory({
        text: 'Second memory entry',
        sourceType: 'manual',
        sourcePath: '/source2',
        metadataJson: '{}',
        sessionId: 'session2',
      });

      expect(entry1.id).not.toBe(entry2.id);
      expect(entry1.contentHash).not.toBe(entry2.contentHash);
    });
  });

  describe('combined search pipeline', () => {
    test('memory search returns structured results', async () => {
      const { MemorySearch } = await import('../../src/memory/search');
      const { lancedbPool } = await import('../../src/memory/database');

      await lancedbPool.connect('memory://test-search');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(lancedbPool);
      const results = await search.search('test', {
        strategy: 'TIERED',
        topK: 5,
        threshold: 0.0,
      });

      expect(Array.isArray(results)).toBe(true);
      for (const result of results) {
        expect(result).toHaveProperty('entry');
        expect(result).toHaveProperty('score');
        expect(typeof result.score).toBe('number');
      }
    });

    test('search respects threshold filtering', async () => {
      const { MemorySearch } = await import('../../src/memory/search');
      const { lancedbPool } = await import('../../src/memory/database');

      await lancedbPool.connect('memory://test-threshold');

      const mockEntry = {
        id: 'test-id',
        text: 'test',
        vector: new Array(1024).fill(0.1),
        sourceType: 'manual' as const,
        sourcePath: '/test',
        timestamp: Date.now(),
        contentHash: 'hash',
        metadataJson: '{}',
        sessionId: 'session',
      };

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ ...mockEntry, _distance: 0.1 }]),
      });

      const search = new MemorySearch(lancedbPool);
      const results = await search.search('test', {
        strategy: 'VECTOR_ONLY',
        topK: 10,
        threshold: 0.99,
      });

      // All results should meet threshold
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.99);
      }
    });

    test('search respects topK limit', async () => {
      const { MemorySearch } = await import('../../src/memory/search');
      const { lancedbPool } = await import('../../src/memory/database');

      await lancedbPool.connect('memory://test-topk');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(lancedbPool);
      const results = await search.search('test', {
        strategy: 'TIERED',
        topK: 3,
        threshold: 0.0,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('chunker integration', () => {
    test('chunkFile produces correct line numbers', () => {
      const { chunkFile } = require('../../src/project-index/chunker');

      const content = `// Line 1
// Line 2
export function first() { // Line 3
  const x = 1; // Line 4
} // Line 5
// Line 6
export class MyClass { // Line 7
  method() {} // Line 8
} // Line 9
// Line 10
export const value = 42; // Line 11`;

      const chunks = chunkFile('test.ts', content);

      expect(chunks.length).toBeGreaterThan(0);

      for (const chunk of chunks) {
        expect(chunk.lineStart).toBeGreaterThan(0);
        expect(chunk.lineEnd).toBeGreaterThanOrEqual(chunk.lineStart);
        expect(chunk.lineEnd).toBeLessThanOrEqual(11);
      }
    });

    test('chunkFile handles Python with decorators correctly', () => {
      const { chunkFile } = require('../../src/project-index/chunker');

      const content = `@decorator
def function_with_decorator():
    pass

class ClassWithDecorator:
    @property
    def value(self):
        return 42`;

      const chunks = chunkFile('test.py', content);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('end-to-end workflow simulation', () => {
    test('simulated workflow: index → add memory → search', async () => {
      // Step 1: Create project files
      const projectFile = path.join(testDir, 'project.ts');
      writeFileSync(projectFile, `export function calculateSum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

export function calculateProduct(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc * n, 1);
}`);

      // Step 2: Index project
      const { ProjectIndexer } = await import('../../src/project-index/indexer');
      const indexer = new ProjectIndexer(dbPath, testDir);
      await indexer.start();
      await indexer.indexFile(projectFile);

      expect(indexer.getStats().totalFiles).toBe(1);
      expect(indexer.getStats().totalChunks).toBeGreaterThan(0);

      // Step 3: Add memory about the project
      const { addMemory } = await import('../../src/memory/operations');
      const { lancedbPool } = await import('../../src/memory/database');

      await lancedbPool.connect('memory://workflow');

      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const memory = await addMemory({
        text: 'Project contains calculateSum and calculateProduct functions for array operations',
        sourceType: 'file',
        sourcePath: projectFile,
        metadataJson: JSON.stringify({ type: 'documentation' }),
        sessionId: 'project-session',
      });

      expect(memory.id).toBeDefined();

      // Step 4: Search for the memory
      const { MemorySearch } = await import('../../src/memory/search');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(lancedbPool);

      const searchResults = await search.search('calculate functions', {
        strategy: 'TIERED',
        topK: 10,
        threshold: 0.0,
      });

      expect(Array.isArray(searchResults)).toBe(true);

      // Cleanup
      await indexer.stop();
    });

    test('simulated multi-file project indexing', async () => {
      const { ProjectIndexer } = await import('../../src/project-index/indexer');
      const indexer = new ProjectIndexer(dbPath, testDir);
      await indexer.start();

      // Create a small project structure
      const files = [
        { name: 'index.ts', content: `export * from './utils';\nexport * from './helpers';` },
        { name: 'utils.ts', content: `export function identity<T>(x: T): T { return x; }` },
        { name: 'helpers.ts', content: `export function map<T, U>(fn: (x: T) => U, arr: T[]): U[] { return arr.map(fn); }` },
        { name: 'types.ts', content: `export type Result<T> = { ok: true; value: T } | { ok: false; error: string };` },
      ];

      for (const file of files) {
        const filePath = path.join(testDir, file.name);
        writeFileSync(filePath, file.content);
        await indexer.indexFile(filePath);
      }

      const stats = indexer.getStats();
      expect(stats.totalFiles).toBe(4);
      expect(stats.totalChunks).toBeGreaterThan(0);

      await indexer.stop();
    });
  });
});
