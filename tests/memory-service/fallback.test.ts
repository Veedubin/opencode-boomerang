import { test, expect, describe } from 'vitest';
import { MemoryService } from '../../src/memory-service';

describe('MemoryService Fallback Mode', () => {
  test('returns empty results in fallback mode', async () => {
    const service = new MemoryService();
    // Force fallback by not initializing
    (service as any).fallbackMode = true;
    
    const results = await service.queryMemories('test');
    expect(results).toEqual([]);
  });

  test('returns dummy ID in fallback mode', async () => {
    const service = new MemoryService();
    (service as any).fallbackMode = true;
    
    const result = await service.addMemory({ content: 'test' });
    expect(result.id).toMatch(/^fallback-/);
  });

  test('isInitialized returns true in fallback mode', () => {
    const service = new MemoryService();
    (service as any).fallbackMode = true;
    
    expect(service.isInitialized()).toBe(true);
    expect(service.isFallbackMode()).toBe(true);
  });

  test('searchProject returns empty array in fallback mode', async () => {
    const service = new MemoryService();
    (service as any).fallbackMode = true;
    
    const results = await service.searchProject('test');
    expect(results).toEqual([]);
  });

  test('indexProject does nothing in fallback mode', async () => {
    const service = new MemoryService();
    (service as any).fallbackMode = true;
    
    // Should not throw
    await expect(service.indexProject('/tmp/test')).resolves.toBeUndefined();
  });
});