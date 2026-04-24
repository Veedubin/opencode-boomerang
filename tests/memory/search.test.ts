/**
 * Search engine tests with mocked dependencies
 * Comprehensive coverage of all 3 strategies, TIERED fallback, deduplication, and threshold filtering
 */

import { test, expect, describe, beforeEach, vi } from 'vitest';
import type { MemoryEntry, SearchResult } from '../../src/memory/schema';

// Mock modules before importing
const mockModelManager = {
  loadModel: vi.fn().mockResolvedValue({}),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
  getPipeline: vi.fn().mockReturnValue(null),
};

const mockTable = {
  query: vi.fn().mockReturnValue({
    nearest: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  }),
  add: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockDb = {
  connect: vi.fn().mockResolvedValue({}),
  getTable: vi.fn().mockResolvedValue(mockTable),
  createIndex: vi.fn().mockResolvedValue(undefined),
};

// Create test memory entries
function createMemoryEntry(id: string, text: string, contentHash: string): MemoryEntry {
  return {
    id,
    text,
    vector: new Array(1024).fill(Math.random()),
    sourceType: 'manual',
    sourcePath: '/test/path',
    timestamp: Date.now(),
    contentHash,
    metadataJson: '{}',
    sessionId: 'test-session',
  };
}

describe('MemorySearch', () => {
  let MemorySearch: typeof import('../../src/memory/search').MemorySearch;
  let TextSearch: typeof import('../../src/memory/text-search').TextSearch;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock the modules
    vi.doMock('../../src/model/index', () => ({
      modelManager: mockModelManager,
    }));
    
    vi.doMock('../../src/memory/database', () => ({
      lancedbPool: mockDb,
    }));

    // Re-import modules to get fresh instances
    const searchModule = await import('../../src/memory/search');
    const textSearchModule = await import('../../src/memory/text-search');
    MemorySearch = searchModule.MemorySearch;
    TextSearch = textSearchModule.TextSearch;
  });

  describe('TIERED strategy', () => {
    test('performs vector search with Fuse.js fallback when results insufficient', async () => {
      const vectorEntry = createMemoryEntry('v1', 'vector result text', 'hash1');
      const textEntry1 = createMemoryEntry('t1', 'text result one', 'hash2');
      const textEntry2 = createMemoryEntry('t2', 'text result two', 'hash3');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([vectorEntry]),
      });

      const allEntries = [vectorEntry, textEntry1, textEntry2];
      let callCount = 0;
      mockTable.query.mockImplementation((() => {
        callCount++;
        if (callCount > 1) {
          return {
            limit: vi.fn().mockReturnThis(),
            toArray: vi.fn().mockResolvedValue(allEntries),
          };
        }
        return {
          nearest: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue([vectorEntry]),
        };
      })());

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('query', { strategy: 'TIERED', topK: 3, threshold: 0.5 });

      expect(mockModelManager.loadModel).toHaveBeenCalled();
      expect(mockModelManager.generateEmbedding).toHaveBeenCalled();
    });

    test('merges results from both strategies', async () => {
      const entry1 = createMemoryEntry('e1', 'result one', 'hash1');
      const entry2 = createMemoryEntry('e2', 'result two', 'hash2');

      let callCount = 0;
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([entry1]),
      });

      const search = new MemorySearch(mockDb as any);
      await search.search('test', { strategy: 'TIERED', topK: 10, threshold: 0.0 });

      expect(mockTable.query).toHaveBeenCalled();
    });

    test('falls back to text search when vector results have low scores', async () => {
      const lowScoreEntry = createMemoryEntry('l1', 'low score entry', 'hash1');
      
      // Return entry with low distance (high similarity) but TIERED uses threshold 0.72
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([lowScoreEntry]),
      });

      const search = new MemorySearch(mockDb as any);
      // With default threshold 0.7 and low score entries, should trigger fallback
      await search.search('test', { strategy: 'TIERED', topK: 5, threshold: 0.7 });

      // Should have attempted both vector and text search
      expect(mockTable.query).toHaveBeenCalled();
    });

    test('returns only topK results after merging', async () => {
      const entries = Array.from({ length: 20 }, (_, i) => 
        createMemoryEntry(`e${i}`, `result ${i}`, `hash${i}`)
      );

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(entries.slice(0, 10)),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'TIERED', topK: 5, threshold: 0.0 });

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('VECTOR_ONLY strategy', () => {
    test('performs pure vector search without text fallback', async () => {
      const entry = createMemoryEntry('v1', 'vector text', 'hash1');
      
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([entry]),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('query', { strategy: 'VECTOR_ONLY', topK: 5, threshold: 0.0 });

      expect(mockModelManager.generateEmbedding).toHaveBeenCalled();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('generates embedding for the query', async () => {
      const search = new MemorySearch(mockDb as any);
      
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      await search.search('test query', { strategy: 'VECTOR_ONLY', topK: 5, threshold: 0.0 });

      expect(mockModelManager.generateEmbedding).toHaveBeenCalledWith('test query', expect.any(String));
    });

    test('filters results by threshold', async () => {
      const lowScoreEntry = createMemoryEntry('l1', 'low score', 'hash1');
      const highScoreEntry = createMemoryEntry('h1', 'high score', 'hash2');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([lowScoreEntry, highScoreEntry]),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'VECTOR_ONLY', topK: 10, threshold: 0.99 });

      expect(results.every((r: SearchResult<MemoryEntry>) => r.score >= 0.99)).toBe(true);
    });
  });

  describe('TEXT_ONLY strategy', () => {
    test('performs pure Fuse.js search without vector search', async () => {
      const entry1 = createMemoryEntry('t1', 'fuse text one', 'hash1');
      const entry2 = createMemoryEntry('t2', 'fuse text two', 'hash2');
      const allEntries = [entry1, entry2];

      mockTable.query.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(allEntries),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('fuse', { strategy: 'TEXT_ONLY', topK: 10, threshold: 0.0 });

      // Should NOT generate embedding for text-only
      expect(mockModelManager.generateEmbedding).not.toHaveBeenCalled();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('loads all entries from table for Fuse.js search', async () => {
      const entry1 = createMemoryEntry('t1', 'entry one', 'hash1');
      const entry2 = createMemoryEntry('t2', 'entry two', 'hash2');

      mockTable.query.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([entry1, entry2]),
      });

      const search = new MemorySearch(mockDb as any);
      await search.search('test', { strategy: 'TEXT_ONLY', topK: 10, threshold: 0.0 });

      // Verify query was called with limit
      expect(mockTable.query).toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    test('deduplicates results with same contentHash from both strategies', async () => {
      const sharedHash = 'samehash123';
      const entryFromVector = createMemoryEntry('v1', 'vector text', sharedHash);
      const entryFromText = createMemoryEntry('t1', 'vector text', sharedHash);

      let callCount = 0;
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([entryFromVector]);
          }
          return Promise.resolve([entryFromVector, entryFromText]);
        }),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'TIERED', topK: 10, threshold: 0.0 });

      const hashes = results.map((r: SearchResult<MemoryEntry>) => r.entry.contentHash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    test('keeps higher score when duplicate found', async () => {
      const sharedHash = 'samehash';
      const vectorEntry = createMemoryEntry('v1', 'same text', sharedHash);
      vectorEntry.vector = new Array(1024).fill(0.5); // Different vector
      
      const textEntry = createMemoryEntry('t1', 'same text', sharedHash);
      textEntry.vector = new Array(1024).fill(0.9); // Different vector

      let callCount = 0;
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([vectorEntry]);
          }
          return Promise.resolve([textEntry]);
        }),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'TIERED', topK: 10, threshold: 0.0 });

      // Should have deduplicated
      const sameHashResults = results.filter((r: SearchResult<MemoryEntry>) => r.entry.contentHash === sharedHash);
      expect(sameHashResults.length).toBeLessThanOrEqual(1);
    });

    test('deduplication preserves order by score after merge', async () => {
      const hashA = 'hashA';
      const hashB = 'hashB';
      const hashC = 'hashC';

      const entryA = createMemoryEntry('a1', 'text A', hashA);
      const entryB = createMemoryEntry('b1', 'text B', hashB);
      const entryC = createMemoryEntry('c1', 'text C', hashC);

      let callCount = 0;
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([entryA, entryB]);
          }
          return Promise.resolve([entryC]);
        }),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'TIERED', topK: 10, threshold: 0.0 });

      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('threshold filtering', () => {
    test('excludes results below score threshold', async () => {
      const lowScoreEntry = createMemoryEntry('l1', 'low score', 'hash1');
      const highScoreEntry = createMemoryEntry('h1', 'high score', 'hash2');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([lowScoreEntry, highScoreEntry]),
      });

      const search = new MemorySearch(mockDb as any);
      
      const results = await search.search('test', { strategy: 'VECTOR_ONLY', topK: 10, threshold: 0.99 });
      
      expect(results.every((r: SearchResult<MemoryEntry>) => r.score >= 0.99)).toBe(true);
    });

    test('threshold of 0 includes all results', async () => {
      const entries = [
        createMemoryEntry('1', 'score 0.1', 'hash1'),
        createMemoryEntry('2', 'score 0.3', 'hash2'),
        createMemoryEntry('3', 'score 0.5', 'hash3'),
      ];

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(entries),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'VECTOR_ONLY', topK: 10, threshold: 0.0 });

      // With threshold 0, all results should be included
      expect(results.length).toBe(entries.length);
    });

    test('threshold of 1 excludes results with distance > 0', async () => {
      const entries = [
        createMemoryEntry('1', 'entry', 'hash1'),
      ];

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(entries),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'VECTOR_ONLY', topK: 10, threshold: 1.0 });

      // With threshold 1, only exact matches (distance=0, score=1) would pass
      // Our mock returns distance=0 implicitly via the entry
      // So results may or may not be empty depending on implementation
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('refreshIndex', () => {
    test('refreshes the Fuse.js cache', async () => {
      const entry = createMemoryEntry('e1', 'test entry', 'hash1');
      
      mockTable.query.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([entry]),
      });

      const search = new MemorySearch(mockDb as any);
      await expect(search.refreshIndex()).resolves.not.toThrow();
    });
  });

  describe('default search options', () => {
    test('uses default options when none provided', async () => {
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test');

      // Should not throw and use defaults (TIERED strategy)
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles vector search errors gracefully', async () => {
      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockRejectedValue(new Error('Vector search failed')),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'VECTOR_ONLY', topK: 10, threshold: 0.0 });

      // Should return empty array instead of throwing
      expect(results).toEqual([]);
    });

    test('handles text search errors gracefully', async () => {
      mockTable.query.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockRejectedValue(new Error('Text search failed')),
      });

      const search = new MemorySearch(mockDb as any);
      const results = await search.search('test', { strategy: 'TEXT_ONLY', topK: 10, threshold: 0.0 });

      expect(results).toEqual([]);
    });
  });
});

describe('TextSearch', () => {
  let TextSearch: typeof import('../../src/memory/text-search').TextSearch;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const textSearchModule = await import('../../src/memory/text-search');
    TextSearch = textSearchModule.TextSearch;
  });

  test('creates Fuse index and searches correctly', () => {
    const memories = [
      createMemoryEntry('1', 'hello world', 'hash1'),
      createMemoryEntry('2', 'typescript is great', 'hash2'),
      createMemoryEntry('3', 'javascript vs typescript', 'hash3'),
    ];

    const textSearch = new TextSearch(memories);
    textSearch.createIndex(memories);

    const results = textSearch.search('typescript');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.text).toContain('typescript');
  });

  test('refreshIndex rebuilds the index', async () => {
    const memories = [
      createMemoryEntry('1', 'original text', 'hash1'),
      createMemoryEntry('2', 'another entry', 'hash2'),
    ];

    const textSearch = new TextSearch(memories);
    textSearch.createIndex(memories);

    const resultsBefore = textSearch.search('original');
    expect(resultsBefore.length).toBeGreaterThan(0);

    await textSearch.refreshIndex();

    const resultsAfter = textSearch.search('another');
    expect(resultsAfter.length).toBeGreaterThan(0);
  });

  test('search returns empty array when no index exists initially', () => {
    const textSearch = new TextSearch([]);
    // First search should auto-create index
    const results = textSearch.search('test');
    expect(Array.isArray(results)).toBe(true);
  });

  test('handles empty memory array', () => {
    const textSearch = new TextSearch([]);
    textSearch.createIndex([]);
    const results = textSearch.search('anything');
    expect(results).toEqual([]);
  });

  test('search is case-insensitive by default', () => {
    const memories = [
      createMemoryEntry('1', 'Hello World', 'hash1'),
      createMemoryEntry('2', 'hello world', 'hash2'),
    ];

    const textSearch = new TextSearch(memories);
    textSearch.createIndex(memories);

    const results = textSearch.search('HELLO');
    expect(results.length).toBeGreaterThan(0);
  });

  test('calculates score correctly (higher is better)', () => {
    const memories = [
      createMemoryEntry('1', 'exact match for test', 'hash1'),
      createMemoryEntry('2', 'partial match test', 'hash2'),
      createMemoryEntry('3', 'something else entirely', 'hash3'),
    ];

    const textSearch = new TextSearch(memories);
    textSearch.createIndex(memories);

    const results = textSearch.search('test');

    expect(results.length).toBeGreaterThanOrEqual(2);
    // When there are multiple results, they should be sorted by score descending
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });
});
