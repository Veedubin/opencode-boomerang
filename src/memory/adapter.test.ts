/**
 * Unit tests for the memory adapter module
 * Tests type conversions between boomerang-v2 and Super-Memory-TS
 */

import { describe, it, expect } from 'vitest';
import { adaptMemoryEntry, toSmtMemoryEntryInput, mapSourceType, reverseMapSourceType } from './adapter.js';
import type { MemoryEntry as SmtMemoryEntry } from '@veedubin/super-memory-ts/dist/memory/schema.js';

describe('Memory Adapter', () => {
  describe('adaptMemoryEntry', () => {
    it('converts Date timestamp to number', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
        score: 0.95,
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBe(new Date('2024-01-15T10:30:00Z').getTime());
    });

    it('converts number timestamp directly', () => {
      const timestamp = 1705315800000;
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: timestamp,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
        score: 0.95,
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.timestamp).toBe(timestamp);
    });

    it('converts Float32Array vector to number[]', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
        sourceType: 'file',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(Array.isArray(result.vector)).toBe(true);
      expect(result.vector).toHaveLength(5);
      expect(result.vector[0]).toBeCloseTo(0.1);
      expect(result.vector[1]).toBeCloseTo(0.2);
      expect(result.vector[2]).toBeCloseTo(0.3);
      expect(result.vector[3]).toBeCloseTo(0.4);
      expect(result.vector[4]).toBeCloseTo(0.5);
    });

    it('handles null/undefined vector by returning empty array', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: null as any,
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.vector).toEqual([]);
    });

    it('maps session sourceType to conversation', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sourceType).toBe('conversation');
    });

    it('maps file sourceType directly', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'file',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sourceType).toBe('file');
    });

    it('maps web sourceType directly', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'web',
        sourcePath: 'https://example.com',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sourceType).toBe('web');
    });

    it('maps boomerang sourceType to manual', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'boomerang',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sourceType).toBe('manual');
    });

    it('maps project sourceType to manual', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'project',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sourceType).toBe('manual');
    });

    it('handles undefined sourcePath by defaulting to empty string', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'session',
        sourcePath: undefined as any,
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sourcePath).toBe('');
    });

    it('handles undefined metadataJson by defaulting to empty JSON', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: undefined as any,
        sessionId: 'session-1',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.metadataJson).toBe('{}');
    });

    it('handles undefined sessionId by defaulting to empty string', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'test-id',
        text: 'Test memory',
        vector: new Float32Array([0.1]),
        sourceType: 'session',
        sourcePath: '/test/path',
        timestamp: 1705315800000,
        contentHash: 'abc123',
        metadataJson: '{}',
        sessionId: undefined as any,
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.sessionId).toBe('');
    });

    it('preserves all other fields correctly', () => {
      const smtEntry: SmtMemoryEntry = {
        id: 'specific-id',
        text: 'Specific memory text',
        vector: new Float32Array([0.1, 0.2]),
        sourceType: 'file',
        sourcePath: '/specific/path.ts',
        timestamp: new Date('2024-06-01T12:00:00Z'),
        contentHash: 'specific-hash',
        metadataJson: '{"key":"value"}',
        sessionId: 'specific-session',
        score: 0.88,
        projectId: 'specific-project',
      };

      const result = adaptMemoryEntry(smtEntry);

      expect(result.id).toBe('specific-id');
      expect(result.text).toBe('Specific memory text');
      expect(result.contentHash).toBe('specific-hash');
      expect(result.metadataJson).toBe('{"key":"value"}');
      expect(result.sessionId).toBe('specific-session');
      expect(result.score).toBe(0.88);
    });
  });

  describe('toSmtMemoryEntryInput', () => {
    it('converts number[] vector to Float32Array', () => {
      const entry = {
        text: 'Test memory',
        vector: [0.1, 0.2, 0.3, 0.4, 0.5],
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.vector).toBeInstanceOf(Float32Array);
      expect(result.vector!.length).toBe(5);
      expect(result.vector![0]).toBeCloseTo(0.1);
      expect(result.vector![1]).toBeCloseTo(0.2);
      expect(result.vector![2]).toBeCloseTo(0.3);
      expect(result.vector![3]).toBeCloseTo(0.4);
      expect(result.vector![4]).toBeCloseTo(0.5);
    });

    it('handles undefined vector by not including it', () => {
      const entry = {
        text: 'Test memory',
        vector: undefined,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.vector).toBeUndefined();
    });

    it('handles null vector by not including it', () => {
      const entry = {
        text: 'Test memory',
        vector: null as any,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.vector).toBeUndefined();
    });

    it('defaults text to empty string if not provided', () => {
      const entry = {} as any;

      const result = toSmtMemoryEntryInput(entry);

      expect(result.text).toBe('');
    });

    it('maps conversation sourceType to session', () => {
      const entry = {
        text: 'Test',
        sourceType: 'conversation' as const,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourceType).toBe('session');
    });

    it('maps file sourceType directly', () => {
      const entry = {
        text: 'Test',
        sourceType: 'file' as const,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourceType).toBe('file');
    });

    it('maps web sourceType directly', () => {
      const entry = {
        text: 'Test',
        sourceType: 'web' as const,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourceType).toBe('web');
    });

    it('maps manual sourceType to boomerang', () => {
      const entry = {
        text: 'Test',
        sourceType: 'manual' as const,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourceType).toBe('boomerang');
    });

    it('defaults to boomerang for unknown sourceType', () => {
      const entry = {
        text: 'Test',
        sourceType: 'unknown' as any,
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourceType).toBe('boomerang');
    });

    it('defaults sourceType to boomerang when not provided', () => {
      const entry = {
        text: 'Test',
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourceType).toBe('boomerang');
    });

    it('passes through sourcePath when provided', () => {
      const entry = {
        text: 'Test',
        sourcePath: '/custom/path.ts',
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sourcePath).toBe('/custom/path.ts');
    });

    it('passes through metadataJson when provided', () => {
      const entry = {
        text: 'Test',
        metadataJson: '{"custom":"data"}',
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.metadataJson).toBe('{"custom":"data"}');
    });

    it('passes through sessionId when provided', () => {
      const entry = {
        text: 'Test',
        sessionId: 'my-session',
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.sessionId).toBe('my-session');
    });

    it('passes through projectId when provided', () => {
      const entry = {
        text: 'Test',
        projectId: 'my-project',
      };

      const result = toSmtMemoryEntryInput(entry);

      expect(result.projectId).toBe('my-project');
    });
  });

  describe('mapSourceType', () => {
    it('maps conversation to session', () => {
      expect(mapSourceType('conversation')).toBe('session');
    });

    it('maps file to file', () => {
      expect(mapSourceType('file')).toBe('file');
    });

    it('maps web to web', () => {
      expect(mapSourceType('web')).toBe('web');
    });

    it('maps manual to boomerang', () => {
      expect(mapSourceType('manual')).toBe('boomerang');
    });

    it('defaults unknown types to boomerang', () => {
      expect(mapSourceType('unknown')).toBe('boomerang');
      expect(mapSourceType('')).toBe('boomerang');
    });
  });

  describe('reverseMapSourceType', () => {
    it('maps session to conversation', () => {
      expect(reverseMapSourceType('session')).toBe('conversation');
    });

    it('maps file to file', () => {
      expect(reverseMapSourceType('file')).toBe('file');
    });

    it('maps web to web', () => {
      expect(reverseMapSourceType('web')).toBe('web');
    });

    it('maps boomerang to manual', () => {
      expect(reverseMapSourceType('boomerang')).toBe('manual');
    });

    it('maps project to manual', () => {
      expect(reverseMapSourceType('project')).toBe('manual');
    });

    it('returns unknown types as-is', () => {
      expect(reverseMapSourceType('unknown')).toBe('unknown');
      expect(reverseMapSourceType('')).toBe('');
    });
  });
});
