import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { MemoryService, getMemoryService } from '../../src/memory-service';
import { getMemorySystem } from '../../src/memory/index.js';
import { searchProject } from '../../src/project-index/search.js';

// Define mocks at the top level
const mockMemorySystem = {
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: vi.fn().mockReturnValue(true),
  search: vi.fn().mockResolvedValue([
    { entry: { id: '1', text: 'Test memory', metadataJson: '{}' }, score: 0.95 },
  ]),
  addMemory: vi.fn().mockResolvedValue({ id: 'test-mem-123' }),
};

// Set up the mock before the module loads
vi.mock('../../src/memory/index.js', () => ({
  getMemorySystem: vi.fn(() => mockMemorySystem),
}));

vi.mock('../../src/project-index/search.js', () => ({
  searchProject: vi.fn().mockResolvedValue([]),
}));

describe('MemoryService (Built-in Integration)', () => {
  let service: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock return values for each test
    mockMemorySystem.search.mockResolvedValue([
      { entry: { id: '1', text: 'Test memory', metadataJson: '{}' }, score: 0.95 },
    ]);
    service = new MemoryService();
  });

  test('can initialize', async () => {
    await service.initialize();
    expect(service.isInitialized()).toBe(true);
  });

  test('can query memories', async () => {
    await service.initialize();
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