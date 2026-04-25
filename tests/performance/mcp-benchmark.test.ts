import { describe, test, expect, vi } from 'vitest';
import { MemoryService } from '../../src/memory-service';

describe('MemoryService Performance', () => {
  test('direct memory operations should be fast', async () => {
    const service = new MemoryService();
    // Mock to skip initialization
    const { getMemorySystem } = await import('../../src/memory/index.js');
    const mockSystem = getMemorySystem();
    mockSystem.search.mockResolvedValue([]);

    const start = performance.now();
    await service.queryMemories('test');
    const latency = performance.now() - start;

    expect(latency).toBeLessThan(10); // Direct calls should be very fast
  });
});