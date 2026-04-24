/**
 * Integration tests for memory operations flow
 * Tests: add → query → get flow, project index → search flow, session save → load flow
 */

import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';

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

// Import after mocks are set up
import { lancedbPool } from '../../src/memory/database';

describe('Memory Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('add → query → get flow', () => {
    test('can add memory and retrieve it by ID', async () => {
      const { addMemory, getMemory } = await import('../../src/memory/operations');

      // Setup: connect to establish the connection in pool
      await lancedbPool.connect('memory://test-add-get');

      // Mock the query to return empty for the duplicate check
      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]), // No duplicate
      });

      const entry = await addMemory({
        text: 'Test memory entry for retrieval',
        sourceType: 'manual',
        sourcePath: '/test/path',
        metadataJson: '{}',
        sessionId: 'test-session',
      });

      expect(entry.id).toBeDefined();
      expect(entry.text).toBe('Test memory entry for retrieval');
      expect(entry.contentHash).toBeDefined();
      expect(entry.vector).toHaveLength(1024);

      // Mock to return the entry when queried by ID
      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([entry]),
      });

      // Retrieve by ID
      const retrieved = await getMemory(entry.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(entry.id);
      expect(retrieved?.text).toBe(entry.text);
    });

    test('addMemory generates unique content hash for same text', async () => {
      const { addMemory } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-hash');

      // Mock the query to return empty for duplicate check
      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const entry1 = await addMemory({
        text: 'Same text',
        sourceType: 'manual',
        sourcePath: '/test/path1',
        metadataJson: '{}',
        sessionId: 'session1',
      });

      const entry2 = await addMemory({
        text: 'Same text',
        sourceType: 'manual',
        sourcePath: '/test/path2',
        metadataJson: '{}',
        sessionId: 'session2',
      });

      // Same text should produce same content hash
      expect(entry1.contentHash).toBe(entry2.contentHash);
    });

    test('getMemory returns null for non-existent ID', async () => {
      const { getMemory } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-null');

      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const result = await getMemory('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('session save → load flow', () => {
    test('saveContext stores entry with session metadata', async () => {
      const { saveContext } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-save-context');

      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const sessionId = 'test-session-' + Date.now();
      const contextText = 'This is session context data';

      const entry = await saveContext(sessionId, contextText);

      expect(entry.sessionId).toBe(sessionId);
      expect(entry.sourceType).toBe('conversation');
      expect(entry.sourcePath).toContain(sessionId);
      expect(entry.text).toBe(contextText);
    });

    test('getContext retrieves most recent context for session', async () => {
      const { getContext } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-get-context');

      const sessionId = 'test-session-' + Date.now();
      const contexts = [
        { text: 'First context', timestamp: 1000 },
        { text: 'Second context', timestamp: 2000 },
        { text: 'Third context - most recent', timestamp: 3000 },
      ];

      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(contexts.map((c, i) => ({
          ...c,
          id: `context-${i}`,
          sourceType: 'conversation',
          sourcePath: `session://${sessionId}`,
          metadataJson: '{}',
          sessionId,
        }))),
      });

      const context = await getContext(sessionId);

      expect(context).not.toBeNull();
      expect(context?.text).toBe('Third context - most recent');
    });

    test('getContext returns null for unknown session', async () => {
      const { getContext } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-unknown');

      mockTable.query.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const context = await getContext('unknown-session-id');
      expect(context).toBeNull();
    });
  });

  describe('delete memory flow', () => {
    test('deleteMemory returns true when deletion succeeds', async () => {
      const { deleteMemory } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-delete');

      mockTable.delete.mockResolvedValue(undefined);

      const result = await deleteMemory('some-id');
      expect(result).toBe(true);
    });

    test('deleteMemory returns false when deletion fails', async () => {
      const { deleteMemory } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-delete-fail');

      mockTable.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await deleteMemory('some-id');
      expect(result).toBe(false);
    });
  });

  describe('list sources flow', () => {
    test('listSources returns unique paths', async () => {
      const { listSources } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-list-sources');

      mockTable.query.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { sourcePath: '/project/src/file1.ts', sourceType: 'file' },
          { sourcePath: '/project/src/file2.ts', sourceType: 'file' },
          { sourcePath: '/project/src/file1.ts', sourceType: 'file' },
        ]),
      });

      const sources = await listSources('file');
      expect(sources).toHaveLength(2);
      expect(sources).toContain('/project/src/file1.ts');
      expect(sources).toContain('/project/src/file2.ts');
    });

    test('listSources filters by source type', async () => {
      const { listSources } = await import('../../src/memory/operations');

      await lancedbPool.connect('memory://test-filter');

      mockTable.query.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { sourcePath: '/path1', sourceType: 'file' },
          { sourcePath: '/path2', sourceType: 'manual' },
        ]),
      });

      const fileSources = await listSources('file');
      const manualSources = await listSources('manual');

      expect(fileSources).toHaveLength(1);
      expect(manualSources).toHaveLength(1);
    });
  });

  describe('search integration', () => {
    test('search with VECTOR_ONLY strategy returns results', async () => {
      const { MemorySearch } = await import('../../src/memory/search');

      await lancedbPool.connect('memory://test-vector-only');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(lancedbPool);
      const results = await search.search('test query', {
        strategy: 'VECTOR_ONLY',
        topK: 10,
        threshold: 0.0,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    test('search with TEXT_ONLY strategy returns results', async () => {
      const { MemorySearch } = await import('../../src/memory/search');

      await lancedbPool.connect('memory://test-text-only');

      mockTable.query.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(lancedbPool);
      const results = await search.search('test query', {
        strategy: 'TEXT_ONLY',
        topK: 10,
        threshold: 0.0,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    test('search with TIERED strategy uses fallback', async () => {
      const { MemorySearch } = await import('../../src/memory/search');

      await lancedbPool.connect('memory://test-tiered');

      mockTable.query.mockReturnValue({
        nearest: vi.fn().mockReturnThis(),
        nearestTo: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });

      const search = new MemorySearch(lancedbPool);
      const results = await search.search('test query', {
        strategy: 'TIERED',
        topK: 10,
        threshold: 0.0,
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });
});
