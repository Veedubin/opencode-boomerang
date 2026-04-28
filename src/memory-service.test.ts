/**
 * Tests for memory-service module
 */

import { test, expect, describe, vi, beforeEach } from 'vitest';
import { MemoryService } from './memory-service.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock protocol tracker
vi.mock('./protocol/tracker.js', () => ({
  protocolTracker: {
    recordToolCall: vi.fn(),
  },
}));

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MemoryService();
  });

  describe('getFileContents', () => {
    test('returns null when file does not exist', async () => {
      const { readFile } = await import('fs/promises');
      
      // Setup mock to reject (file not found)
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      // Initialize in fallback mode to skip index lookup
      // @ts-expect-error - accessing private property for testing
      service['fallbackMode'] = true;

      const result = await service.getFileContents('/nonexistent/file.ts');
      
      expect(result).toBeNull();
      expect(readFile).toHaveBeenCalledWith('/nonexistent/file.ts', 'utf-8');
    });

    test('getFileContents method exists on MemoryService', () => {
      expect(typeof service.getFileContents).toBe('function');
    });
  });

  describe('initialization', () => {
    test('isInitialized returns false before init', () => {
      expect(service.isInitialized()).toBe(false);
    });

    test('isFallbackMode returns false before init', () => {
      expect(service.isFallbackMode()).toBe(false);
    });
  });

  describe('queryMemories', () => {
    test('returns empty array in fallback mode', async () => {
      // @ts-expect-error - accessing private property for testing
      service['fallbackMode'] = true;

      const results = await service.queryMemories('test query');
      expect(results).toEqual([]);
    });
  });

  describe('searchProject', () => {
    test('returns empty array in fallback mode', async () => {
      // @ts-expect-error - accessing private property for testing
      service['fallbackMode'] = true;

      const results = await service.searchProject('test query');
      expect(results).toEqual([]);
    });
  });

  describe('addMemory', () => {
    test('returns fallback id in fallback mode', async () => {
      // @ts-expect-error - accessing private property for testing
      service['fallbackMode'] = true;

      const result = await service.addMemory({ content: 'test memory' });
      expect(result.id).toMatch(/^fallback-/);
    });
  });
});