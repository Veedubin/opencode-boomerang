import { describe, test, expect, vi } from 'vitest';
import { MemoryService } from '../../src/memory-service';

// Mock the memory system to avoid initialization
vi.mock('../../src/memory/index.js', () => ({
  getMemorySystem: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    search: vi.fn().mockResolvedValue([]),
    addMemory: vi.fn().mockResolvedValue({ id: 'test-id' }),
  })),
}));

describe('MemoryService Performance', () => {
  test('direct memory operations should be fast', async () => {
    const service = new MemoryService();
    await service.initialize();

    const start = performance.now();
    await service.queryMemories('test');
    const latency = performance.now() - start;

    expect(latency).toBeLessThan(10); // Direct calls should be very fast
  });
});