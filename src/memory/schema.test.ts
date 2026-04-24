import { test, expect, describe } from 'vitest';
import {
  type MemoryEntry,
  type ProjectChunk,
  type SearchResult,
  type SearchOptions,
  DEFAULT_SEARCH_OPTIONS,
  type SourceType,
} from './schema.js';

describe('schema types', () => {
  describe('MemoryEntry', () => {
    test('has all required fields', () => {
      const entry: MemoryEntry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Test memory content',
        vector: new Array(1024).fill(0.1),
        sourceType: 'file',
        sourcePath: '/path/to/file.ts',
        timestamp: Date.now(),
        contentHash: 'abc123def456',
        metadataJson: '{"key":"value"}',
        sessionId: 'session-123',
      };

      expect(entry.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(entry.text).toBe('Test memory content');
      expect(entry.vector).toHaveLength(1024);
      expect(entry.sourceType).toBe('file');
    });

    test('accepts different source types', () => {
      const sourceTypes: SourceType[] = ['file', 'conversation', 'manual', 'web'];
      sourceTypes.forEach((type) => {
        const entry: MemoryEntry = {
          id: 'test-id',
          text: 'content',
          vector: [],
          sourceType: type,
          sourcePath: '/test',
          timestamp: 0,
          contentHash: 'hash',
          metadataJson: '{}',
          sessionId: 'session',
        };
        expect(entry.sourceType).toBe(type);
      });
    });
  });

  describe('ProjectChunk', () => {
    test('has all required fields', () => {
      const chunk: ProjectChunk = {
        id: 'chunk-123',
        filePath: '/src/index.ts',
        content: 'const x = 1;',
        vector: new Array(1024).fill(0.5),
        chunkIndex: 0,
        lineStart: 1,
        lineEnd: 1,
        contentHash: 'filehash123',
        timestamp: Date.now(),
      };

      expect(chunk.id).toBe('chunk-123');
      expect(chunk.chunkIndex).toBe(0);
      expect(chunk.lineStart).toBe(1);
      expect(chunk.lineEnd).toBe(1);
    });
  });

  describe('SearchResult', () => {
    test('can hold MemoryEntry', () => {
      const entry: MemoryEntry = {
        id: 'id',
        text: 'text',
        vector: [],
        sourceType: 'manual',
        sourcePath: '/test',
        timestamp: 0,
        contentHash: 'hash',
        metadataJson: '{}',
        sessionId: 'session',
      };

      const result: SearchResult<MemoryEntry> = {
        entry,
        score: 0.95,
      };

      expect(result.score).toBe(0.95);
      expect(result.entry.id).toBe('id');
    });

    test('can hold ProjectChunk', () => {
      const chunk: ProjectChunk = {
        id: 'chunk-id',
        filePath: '/file.ts',
        content: 'content',
        vector: [],
        chunkIndex: 0,
        lineStart: 1,
        lineEnd: 5,
        contentHash: 'hash',
        timestamp: 0,
      };

      const result: SearchResult<ProjectChunk> = {
        entry: chunk,
        score: 0.87,
      };

      expect(result.score).toBe(0.87);
      expect(result.entry.filePath).toBe('/file.ts');
    });
  });

  describe('SearchOptions', () => {
    test('has default values', () => {
      expect(DEFAULT_SEARCH_OPTIONS.strategy).toBe('TIERED');
      expect(DEFAULT_SEARCH_OPTIONS.topK).toBe(10);
      expect(DEFAULT_SEARCH_OPTIONS.threshold).toBe(0.7);
    });

    test('accepts all strategy types', () => {
      const strategies: Array<SearchOptions['strategy']> = ['TIERED', 'VECTOR_ONLY', 'TEXT_ONLY'];
      strategies.forEach((strategy) => {
        const options: SearchOptions = {
          strategy,
          topK: 5,
          threshold: 0.5,
        };
        expect(options.strategy).toBe(strategy);
      });
    });
  });
});
