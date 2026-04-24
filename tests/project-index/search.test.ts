/**
 * Tests for Project Search
 */

import { test, expect, describe, vi, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';

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
function createMockTable(results: Record<string, unknown>[] = []) {
  const mockQueryBuilder = createMockQueryBuilder(results);
  return {
    add: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockReturnValue(mockQueryBuilder),
    vectorSearch: vi.fn().mockResolvedValue(results),
  };
}

// Mock dependencies
vi.mock('../../src/memory/database.js', () => ({
  lancedbPool: {
    connect: vi.fn().mockResolvedValue({
      openTable: vi.fn().mockResolvedValue(createMockTable()),
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

import { searchProject, getFileChunks } from '../../src/project-index/search.js';

describe('searchProject', () => {
  let testDir: string;
  let dbUri: string;

  beforeEach(() => {
    testDir = `${tmpdir()}/search-test-${Date.now()}-${Math.random()}`;
    mkdirSync(testDir, { recursive: true });
    dbUri = `${testDir}/test.db`;
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('returns empty array for empty query', async () => {
    const results = await searchProject('', 10, dbUri);
    expect(results).toEqual([]);
  });

  test('returns empty array for whitespace query', async () => {
    const results = await searchProject('   ', 10, dbUri);
    expect(results).toEqual([]);
  });

  test('respects topK limit', async () => {
    const { lancedbPool } = await import('../../src/memory/database.js');
    // Simulate limit being applied - return only 2 results
    const limitedResults = [
      { filePath: 'file1.ts', content: 'content1', lineStart: 1, lineEnd: 10, _distance: 0.1 },
      { filePath: 'file2.ts', content: 'content2', lineStart: 5, lineEnd: 15, _distance: 0.2 },
    ];

    const mockQueryBuilder = createMockQueryBuilder(limitedResults);

    (lancedbPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({
      openTable: vi.fn().mockResolvedValue({
        query: vi.fn().mockReturnValue(mockQueryBuilder),
      }),
    });

    const results = await searchProject('test query', 2, dbUri);
    expect(results.length).toBe(2);
  });

  test('results include file path and line numbers', async () => {
    const { lancedbPool } = await import('../../src/memory/database.js');
    const mockResults = [
      { filePath: '/test/file.ts', content: 'export function test() {}', lineStart: 1, lineEnd: 2, _distance: 0.1 },
    ];

    const mockQueryBuilder = createMockQueryBuilder(mockResults);

    (lancedbPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({
      openTable: vi.fn().mockResolvedValue({
        query: vi.fn().mockReturnValue(mockQueryBuilder),
      }),
    });

    const results = await searchProject('test query', 10, dbUri);

    expect(results.length).toBe(1);
    expect(results[0]).toHaveProperty('filePath');
    expect(results[0]).toHaveProperty('lineStart');
    expect(results[0]).toHaveProperty('lineEnd');
    expect(results[0]).toHaveProperty('content');
    expect(results[0]).toHaveProperty('score');
  });

  test('calculates similarity score from distance', async () => {
    const { lancedbPool } = await import('../../src/memory/database.js');
    const mockResults = [
      { filePath: 'file.ts', content: 'content', lineStart: 1, lineEnd: 10, _distance: 1.0 },
    ];

    const mockQueryBuilder = createMockQueryBuilder(mockResults);

    (lancedbPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({
      openTable: vi.fn().mockResolvedValue({
        query: vi.fn().mockReturnValue(mockQueryBuilder),
      }),
    });

    const results = await searchProject('test query', 10, dbUri);

    expect(results[0].score).toBeCloseTo(0.5, 2); // 1 / (1 + 1) = 0.5
  });

  test('throws error when no dbUri provided', async () => {
    // Clear env
    const originalUri = process.env.LANCEDB_URI;
    delete process.env.LANCEDB_URI;

    await expect(searchProject('test query')).rejects.toThrow('LanceDB URI not provided');

    // Restore
    if (originalUri) {
      process.env.LANCEDB_URI = originalUri;
    }
  });
});

describe('getFileChunks', () => {
  let testDir: string;
  let dbUri: string;

  beforeEach(() => {
    testDir = `${tmpdir()}/search-test-${Date.now()}-${Math.random()}`;
    mkdirSync(testDir, { recursive: true });
    dbUri = `${testDir}/test.db`;
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('returns chunks for specific file', async () => {
    const { lancedbPool } = await import('../../src/memory/database.js');
    const mockChunks = [
      { filePath: '/test/file.ts', content: 'chunk 1', lineStart: 1, lineEnd: 10 },
      { filePath: '/test/file.ts', content: 'chunk 2', lineStart: 11, lineEnd: 20 },
    ];

    const mockQueryBuilder = createMockQueryBuilder(mockChunks);

    (lancedbPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({
      openTable: vi.fn().mockResolvedValue({
        query: vi.fn().mockReturnValue(mockQueryBuilder),
      }),
    });

    const results = await getFileChunks('/test/file.ts', dbUri);

    expect(results.length).toBe(2);
    expect(results[0].filePath).toBe('/test/file.ts');
    expect(results[1].filePath).toBe('/test/file.ts');
  });

  test('returns empty array when file not indexed', async () => {
    const { lancedbPool } = await import('../../src/memory/database.js');
    const mockQueryBuilder = createMockQueryBuilder([]);

    (lancedbPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({
      openTable: vi.fn().mockResolvedValue({
        query: vi.fn().mockReturnValue(mockQueryBuilder),
      }),
    });

    const results = await getFileChunks('/nonexistent/file.ts', dbUri);
    expect(results).toEqual([]);
  });
});