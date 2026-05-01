/**
 * Adapter layer for type conversion between boomerang-v2 and Super-Memory-TS
 * 
 * boomerang-v2 types: number timestamp, number[] vector
 * Super-Memory-TS types: Date timestamp, Float32Array vector
 */

import type { MemoryEntry as SmtMemoryEntry, MemoryEntryInput } from '@veedubin/super-memory-ts/dist/memory/schema.js';
import type { MemoryEntry, SourceType } from './schema.js';

/**
 * Adapt a Super-Memory-TS MemoryEntry to boomerang-v2 MemoryEntry
 */
export function adaptMemoryEntry(smt: SmtMemoryEntry): MemoryEntry {
  return {
    id: smt.id,
    text: smt.text,
    vector: smt.vector ? Array.from(smt.vector) : [],
    sourceType: reverseMapSourceType(smt.sourceType) as SourceType,
    sourcePath: smt.sourcePath ?? '',
    timestamp: smt.timestamp instanceof Date ? smt.timestamp.getTime() : smt.timestamp,
    contentHash: smt.contentHash,
    metadataJson: smt.metadataJson ?? '{}',
    sessionId: smt.sessionId ?? '',
    score: smt.score,
  };
}

/**
 * Convert a boomerang-v2 partial MemoryEntry to Super-Memory-TS MemoryEntryInput
 */
export function toSmtMemoryEntryInput(entry: Partial<MemoryEntry>): MemoryEntryInput {
  return {
    text: entry.text ?? '',
    sourceType: mapSourceType(entry.sourceType ?? 'manual'),
    sourcePath: entry.sourcePath,
    metadataJson: entry.metadataJson,
    sessionId: entry.sessionId,
    projectId: entry.projectId as string | undefined,
    vector: entry.vector ? new Float32Array(entry.vector) : undefined,
  };
}

/**
 * Map boomerang-v2 source type to Super-Memory-TS source type
 */
export function mapSourceType(type: string): 'session' | 'file' | 'web' | 'boomerang' | 'project' {
  switch (type) {
    case 'conversation':
      return 'session';
    case 'file':
      return 'file';
    case 'web':
      return 'web';
    case 'manual':
      return 'boomerang';
    default:
      return 'boomerang';
  }
}

/**
 * Map Super-Memory-TS source type back to boomerang-v2 source type
 */
export function reverseMapSourceType(type: string): string {
  switch (type) {
    case 'session':
      return 'conversation';
    case 'file':
      return 'file';
    case 'web':
      return 'web';
    case 'boomerang':
      return 'manual';
    case 'project':
      return 'manual';
    default:
      return type;
  }
}