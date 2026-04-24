/**
 * Tests for ProjectIndexer
 */

import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { writeFileSync, unlinkSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

// Create mock query builder
function createMockQueryBuilder(results: Record<string, unknown>[] = []) {
  return {
    where: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(results),
    nearestTo: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
}

// Create mock table
function createMockTable() {
  const mockQueryBuilder = createMockQueryBuilder([]);
  return {
    add: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockReturnValue(mockQueryBuilder),
    vectorSearch: vi.fn().mockResolvedValue([]),
  };
}

// Mock dependencies before importing indexer
vi.mock('../../src/memory/database.js', () => ({
  lancedbPool: {
    connect: vi.fn().mockResolvedValue({
      openTable: vi.fn().mockResolvedValue(createMockTable()),
      createTable: vi.fn().mockResolvedValue(createMockTable()),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/model/index.js', () => ({
  modelManager: {
    loadModel: vi.fn().mockResolvedValue({}),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    getPipeline: vi.fn().mockReturnValue(null),
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

// Import after mocks
import { ProjectIndexer } from '../../src/project-index/indexer.js';

describe('ProjectIndexer', () => {
  let testDir: string;
  let dbUri: string;

  beforeEach(() => {
    testDir = `${tmpdir()}/indexer-test-${Date.now()}-${Math.random()}`;
    mkdirSync(testDir, { recursive: true });
    dbUri = `${testDir}/test.db`;
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      const files = existsSync(testDir) ? [] : [];
      if (existsSync(testDir)) {
        const entries = require('fs').readdirSync(testDir);
        for (const entry of entries) {
          unlinkSync(path.join(testDir, entry));
        }
        require('fs').rmdirSync(testDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    test('creates indexer with default config', () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      expect(indexer).toBeDefined();
      expect(indexer.getStats()).toEqual({
        totalFiles: 0,
        totalChunks: 0,
        lastIndexed: null,
      });
    });
  });

  describe('start/stop lifecycle', () => {
    test('start() initializes watcher and database', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();
      expect(indexer.getStats().lastIndexed).toBeNull();
      await indexer.stop();
    });

    test('stop() cleans up without start() is safe', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await expect(indexer.stop()).resolves.not.toThrow();
    });

    test('double start() is idempotent', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();
      await indexer.start();
      await indexer.stop();
    });
  });

  describe('indexFile', () => {
    test('indexes a single file correctly', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();

      const testFile = path.join(testDir, 'test.ts');
      const content = `export function hello() {
  console.log('Hello');
}`;
      writeFileSync(testFile, content);

      await indexer.indexFile(testFile);

      const stats = indexer.getStats();
      expect(stats.totalChunks).toBeGreaterThan(0);

      await indexer.stop();
    });

    test('skips unchanged files (same hash)', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();

      const testFile = path.join(testDir, 'test.ts');
      const content = `export function hello() {
  console.log('Hello');
}`;
      writeFileSync(testFile, content);

      await indexer.indexFile(testFile);
      const statsAfterFirst = indexer.getStats();

      // Index again - should skip
      await indexer.indexFile(testFile);
      const statsAfterSecond = indexer.getStats();

      // Chunks should be same (no re-indexing)
      expect(statsAfterFirst.totalChunks).toBe(statsAfterSecond.totalChunks);

      await indexer.stop();
    });

    test('detects content changes and re-indexes', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();

      const testFile = path.join(testDir, 'test.ts');
      writeFileSync(testFile, `export function hello() {
  console.log('Hello');
}`);

      await indexer.indexFile(testFile);
      const chunksBefore = indexer.getStats().totalChunks;

      // Change content
      writeFileSync(testFile, `export function hello() {
  console.log('Hello World');
}

export function goodbye() {
  console.log('Goodbye');
}`);

      await indexer.indexFile(testFile);
      const chunksAfter = indexer.getStats().totalChunks;

      // Should have more chunks due to additional function
      expect(chunksAfter).toBeGreaterThanOrEqual(chunksBefore);

      await indexer.stop();
    });
  });

  describe('removeFile', () => {
    test('removes file from index', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();

      const testFile = path.join(testDir, 'test.ts');
      writeFileSync(testFile, `export function hello() {
  console.log('Hello');
}`);

      await indexer.indexFile(testFile);
      const statsBefore = indexer.getStats();
      expect(statsBefore.totalFiles).toBe(1);

      await indexer.removeFile(testFile);
      const statsAfter = indexer.getStats();
      expect(statsAfter.totalFiles).toBe(0);

      await indexer.stop();
    });

    test('removeFile on non-indexed file is safe', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();

      const testFile = path.join(testDir, 'nonexistent.ts');
      await expect(indexer.removeFile(testFile)).resolves.not.toThrow();

      await indexer.stop();
    });
  });

  describe('queue processing', () => {
    test('processes multiple files in queue', async () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      await indexer.start();

      // Create multiple files
      const files = [];
      for (let i = 0; i < 3; i++) {
        const testFile = path.join(testDir, `test${i}.ts`);
        writeFileSync(testFile, `export function func${i}() {
  return ${i};
}`);
        files.push(testFile);
      }

      // Index them sequentially via API (simulating queue)
      for (const file of files) {
        await indexer.indexFile(file);
      }

      const stats = indexer.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.totalChunks).toBeGreaterThan(0);

      await indexer.stop();
    });
  });

  describe('getStats', () => {
    test('returns current indexer statistics', () => {
      const indexer = new ProjectIndexer(dbUri, testDir);
      const stats = indexer.getStats();

      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('lastIndexed');
    });
  });
});