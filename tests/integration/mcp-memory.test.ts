import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { MemoryService, getMemoryService } from '../../src/memory-service';

// Mock the underlying memory system
vi.mock('../../src/memory/index.js', () => ({
  getMemorySystem: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    search: vi.fn().mockResolvedValue([]),
    addMemory: vi.fn().mockResolvedValue({ id: 'test-mem-123' }),
  })),
}));

vi.mock('../../src/project-index/search.js', () => ({
  searchProject: vi.fn().mockResolvedValue([]),
}));

describe('MemoryService (Built-in Integration)', () => {
  let service: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MemoryService();
  });

  test('can initialize', async () => {
    await service.initialize();
    expect(service.isInitialized()).toBe(true);
  });

  test('can query memories', async () => {
    await service.initialize();
    const { getMemorySystem } = await import('../../src/memory/index.js');
    const mockSystem = getMemorySystem();
    mockSystem.search.mockResolvedValueOnce([
      { entry: { id: '1', text: 'Test memory', metadataJson: '{}' }, score: 0.95 },
    ]);

    const results = await service.queryMemories('test query');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Test memory');
  });

  test('can add memory', async () => {
    await service.initialize();
    const result = await service.addMemory({ content: 'Test memory' });
    expect(result.id).toBe('test-mem-123');
  });

  test('throws when not initialized', async () => {
    await expect(service.queryMemories('test')).rejects.toThrow('not initialized');
  });
});