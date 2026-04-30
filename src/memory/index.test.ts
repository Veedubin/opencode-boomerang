/**
 * Unit tests for the MemorySystem adapter
 * Tests wrapper around Super-Memory-TS MemorySystem
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use hoisted to avoid hoisting issues
const { mockSmtMemorySystem, mockGetSmtMemorySystem } = vi.hoisted(() => {
  const mockSmtMemorySystem = {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    addMemory: vi.fn().mockResolvedValue('new-memory-id'),
    getMemory: vi.fn(),
    deleteMemory: vi.fn().mockResolvedValue(undefined),
    listMemories: vi.fn(),
    queryMemories: vi.fn(),
  };

  const mockGetSmtMemorySystem = vi.fn().mockReturnValue(mockSmtMemorySystem);

  return { mockSmtMemorySystem, mockGetSmtMemorySystem };
});

vi.mock('@veedubin/super-memory-ts/dist/memory/index.js', () => ({
  MemorySystem: vi.fn(),
  getMemorySystem: mockGetSmtMemorySystem,
}));

import { MemorySystem, getMemorySystem } from './index.js';

describe('MemorySystem Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockSmtMemorySystem.initialize.mockResolvedValue(undefined);
    mockSmtMemorySystem.isInitialized.mockReturnValue(true);
    mockSmtMemorySystem.addMemory.mockResolvedValue('new-memory-id');
    mockSmtMemorySystem.getMemory.mockResolvedValue(null);
    mockSmtMemorySystem.deleteMemory.mockResolvedValue(undefined);
    mockSmtMemorySystem.listMemories.mockResolvedValue([]);
    mockSmtMemorySystem.queryMemories.mockResolvedValue([]);
  });

  describe('singleton behavior', () => {
    it('getMemorySystem returns singleton instance', () => {
      const instance1 = getMemorySystem();
      const instance2 = getMemorySystem();
      expect(instance1).toBe(instance2);
    });

    it('getInstance returns the same singleton', () => {
      const instance1 = MemorySystem.getInstance();
      const instance2 = MemorySystem.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('isInitialized', () => {
    it('returns true when SMT is initialized', () => {
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      const sys = getMemorySystem();
      expect(sys.isInitialized()).toBe(true);
    });

    it('returns false when SMT is not initialized', () => {
      mockSmtMemorySystem.isInitialized.mockReturnValue(false);
      const sys = getMemorySystem();
      expect(sys.isInitialized()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('calls SMT initialize with dbUri', async () => {
      const sys = getMemorySystem();
      await sys.initialize('http://localhost:6333');
      expect(mockSmtMemorySystem.initialize).toHaveBeenCalledWith('http://localhost:6333');
    });
  });

  describe('addMemory', () => {
    it('calls SMT addMemory with converted input', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      
      // Mock getMemory to return a proper entry
      mockSmtMemorySystem.getMemory.mockResolvedValue({
        id: 'new-memory-id',
        text: 'Test memory',
        vector: new Float32Array([0.1, 0.2]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: new Date(),
        contentHash: 'hash123',
        metadataJson: '{}',
        sessionId: 'session-1',
      });

      const result = await sys.addMemory({
        text: 'Test memory',
        sourceType: 'conversation',
        sourcePath: '/test/path',
        sessionId: 'session-1',
      });

      expect(mockSmtMemorySystem.addMemory).toHaveBeenCalled();
      expect(result.text).toBe('Test memory');
    });

    it('addMemory adds entry and retrieves it', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      
      mockSmtMemorySystem.addMemory.mockResolvedValue('added-memory-id');
      mockSmtMemorySystem.getMemory.mockResolvedValue({
        id: 'added-memory-id',
        text: 'Test memory',
        vector: new Float32Array([0.1, 0.2]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: new Date(),
        contentHash: 'hash123',
        metadataJson: '{}',
        sessionId: 'session-1',
      });

      const result = await sys.addMemory({
        text: 'Test memory',
        sourceType: 'conversation',
        sourcePath: '/test/path',
        sessionId: 'session-1',
      });

      expect(mockSmtMemorySystem.addMemory).toHaveBeenCalled();
      expect(result.id).toBe('added-memory-id');
    });
  });

  describe('getMemory', () => {
    it('returns adapted memory entry', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      
      mockSmtMemorySystem.getMemory.mockResolvedValue({
        id: 'test-id',
        text: 'Stored memory',
        vector: new Float32Array([0.1, 0.2]),
        sourceType: 'file',
        sourcePath: '/stored/path',
        timestamp: new Date('2024-01-15'),
        contentHash: 'stored-hash',
        metadataJson: '{}',
        sessionId: 'session-1',
      });

      const result = await sys.getMemory('test-id');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id');
      expect(result?.text).toBe('Stored memory');
      expect(result?.sourceType).toBe('file');
    });

    it('returns null when memory not found', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.getMemory.mockResolvedValue(null);

      const result = await sys.getMemory('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('calls SMT deleteMemory and returns true', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);

      const result = await sys.deleteMemory('test-id');

      expect(mockSmtMemorySystem.deleteMemory).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('returns false when deletion fails', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.deleteMemory.mockRejectedValue(new Error('Delete failed'));

      const result = await sys.deleteMemory('test-id');

      expect(result).toBe(false);
    });
  });

  describe('listSources', () => {
    it('returns deduplicated source paths', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.listMemories.mockResolvedValue([
        { id: '1', text: 'a', vector: new Float32Array([0.1]), sourceType: 'file', sourcePath: '/path/a.ts', timestamp: new Date(), contentHash: 'h1' },
        { id: '2', text: 'b', vector: new Float32Array([0.1]), sourceType: 'file', sourcePath: '/path/b.ts', timestamp: new Date(), contentHash: 'h2' },
        { id: '3', text: 'c', vector: new Float32Array([0.1]), sourceType: 'file', sourcePath: '/path/a.ts', timestamp: new Date(), contentHash: 'h3' },
      ]);

      const result = await sys.listSources();

      expect(result).toHaveLength(2);
      expect(result).toContain('/path/a.ts');
      expect(result).toContain('/path/b.ts');
    });

    it('filters by sourceType when provided', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.listMemories.mockResolvedValue([
        { id: '1', text: 'a', vector: new Float32Array([0.1]), sourceType: 'file', sourcePath: '/path/a.ts', timestamp: new Date(), contentHash: 'h1' },
        { id: '2', text: 'b', vector: new Float32Array([0.1]), sourceType: 'web', sourcePath: 'https://example.com', timestamp: new Date(), contentHash: 'h2' },
      ]);

      const result = await sys.listSources('file');

      expect(result).toHaveLength(1);
      expect(result).toContain('/path/a.ts');
      expect(result).not.toContain('https://example.com');
    });

    it('returns empty array when no sources exist', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.listMemories.mockResolvedValue([]);

      const result = await sys.listSources();

      expect(result).toEqual([]);
    });
  });

  describe('saveContext', () => {
    it('creates entry with session sourcePath and context metadata', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.addMemory.mockResolvedValue('context-id');
      mockSmtMemorySystem.getMemory.mockResolvedValue({
        id: 'context-id',
        text: 'Context content',
        vector: new Float32Array([0.1]),
        sourceType: 'session',
        sourcePath: 'session://my-session',
        timestamp: new Date(),
        contentHash: 'context-hash',
        metadataJson: JSON.stringify({ type: 'context' }),
        sessionId: 'my-session',
      });

      const result = await sys.saveContext('my-session', 'Context content');

      expect(mockSmtMemorySystem.addMemory).toHaveBeenCalled();
      const callArgs = mockSmtMemorySystem.addMemory.mock.calls[0][0];
      expect(callArgs.sourcePath).toBe('session://my-session');
      expect(result.sessionId).toBe('my-session');
    });
  });

  describe('getContext', () => {
    it('returns most recent context entry for session', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.queryMemories.mockResolvedValue([
        {
          id: 'old-context',
          text: 'Old context',
          vector: new Float32Array([0.1]),
          sourceType: 'session',
          sourcePath: 'session://my-session',
          timestamp: new Date('2024-01-01'),
          contentHash: 'old-hash',
          metadataJson: JSON.stringify({ type: 'context' }),
          sessionId: 'my-session',
        },
        {
          id: 'new-context',
          text: 'New context',
          vector: new Float32Array([0.1]),
          sourceType: 'session',
          sourcePath: 'session://my-session',
          timestamp: new Date('2024-06-15'),
          contentHash: 'new-hash',
          metadataJson: JSON.stringify({ type: 'context' }),
          sessionId: 'my-session',
        },
      ]);

      const result = await sys.getContext('my-session');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('New context');
    });

    it('returns null when no context exists', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.queryMemories.mockResolvedValue([]);

      const result = await sys.getContext('unknown-session');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('calls SMT queryMemories and adapts results', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.queryMemories.mockResolvedValue([
        {
          id: 'result-1',
          text: 'Search result',
          vector: new Float32Array([0.1]),
          sourceType: 'file',
          sourcePath: '/result/path',
          timestamp: new Date(),
          contentHash: 'result-hash',
          metadataJson: '{}',
          sessionId: 'session-1',
          score: 0.92,
        },
      ]);

      const results = await sys.search('test query', { topK: 10, strategy: 'TIERED', threshold: 0.7 });

      expect(mockSmtMemorySystem.queryMemories).toHaveBeenCalledWith('test query', expect.objectContaining({
        topK: 10,
        strategy: 'TIERED',
        threshold: 0.7,
      }));
      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe('result-1');
      expect(results[0].score).toBe(0.92);
    });

    it('uses default search options when not provided', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.queryMemories.mockResolvedValue([]);

      await sys.search('test query');

      expect(mockSmtMemorySystem.queryMemories).toHaveBeenCalledWith('test query', expect.objectContaining({
        topK: 10,
        strategy: 'TIERED',
        threshold: 0.7,
      }));
    });

    it('search returns empty array when no results', async () => {
      const sys = getMemorySystem();
      mockSmtMemorySystem.isInitialized.mockReturnValue(true);
      mockSmtMemorySystem.queryMemories.mockResolvedValue([]);

      const results = await sys.search('test query');

      expect(results).toEqual([]);
    });
  });
});
