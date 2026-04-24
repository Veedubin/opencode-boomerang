/**
 * Tests for project-index modules
 */

import { test, expect, describe } from 'vitest';
import { chunkFile } from './chunker.js';
import type { ChunkConfig } from './types.js';

// Test TypeScript file content with various semantic boundaries
const testTsContent = `
export function helloWorld() {
  console.log('Hello, World!');
}

export class Calculator {
  private value: number = 0;

  constructor(initial: number) {
    this.value = initial;
  }

  public add(x: number): number {
    return this.value + x;
  }

  public subtract(x: number): number {
    return this.value - x;
  }
}

export async function fetchData(url: string) {
  const response = await fetch(url);
  return response.json();
}

if (condition) {
  doSomething();
}

export default function main() {
  return true;
}
`;

const testPyContent = `
def hello_world():
    print('Hello, World!')

class Calculator:
    def __init__(self, initial):
        self.value = initial

    def add(self, x):
        return self.value + x

    def subtract(self, x):
        return self.value - x

async def fetch_data(url):
    response = await fetch(url)
    return response.json()

if __name__ == '__main__':
    main()
`;

describe('chunker', () => {
  describe('chunkFile', () => {
    test('returns empty array for empty content', () => {
      const chunks = chunkFile('test.ts', '');
      expect(chunks).toEqual([]);
    });

    test('chunks TypeScript file at semantic boundaries', () => {
      const chunks = chunkFile('test.ts', testTsContent);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that chunks have correct structure
      for (const chunk of chunks) {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('lineStart');
        expect(chunk).toHaveProperty('lineEnd');
        expect(chunk).toHaveProperty('index');
        expect(chunk.lineStart).toBeGreaterThan(0);
        expect(chunk.lineEnd).toBeGreaterThanOrEqual(chunk.lineStart);
        expect(chunk.index).toBeGreaterThanOrEqual(0);
      }

      // Check line numbers are sequential and non-overlapping
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].lineStart).toBeGreaterThan(chunks[i - 1].lineStart);
      }
    });

    test('chunks Python file at semantic boundaries', () => {
      const chunks = chunkFile('test.py', testPyContent);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that function definitions are preserved in chunks
      const allContent = chunks.map(c => c.content).join('\n');
      expect(allContent).toContain('def hello_world');
      expect(allContent).toContain('class Calculator');
      expect(allContent).toContain('def add');
    });

    test('uses sliding window for unsupported file types', () => {
      const txtContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const chunks = chunkFile('test.txt', txtContent);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should still produce valid chunks
      for (const chunk of chunks) {
        expect(chunk.content).toBeTruthy();
        expect(chunk.lineStart).toBeGreaterThan(0);
        expect(chunk.lineEnd).toBeGreaterThanOrEqual(chunk.lineStart);
      }
    });

    test('respects custom chunk config', () => {
      const config: ChunkConfig = {
        chunkSize: 100,
        chunkOverlap: 20,
      };
      
      const chunks = chunkFile('test.ts', testTsContent, config);
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
    });

    test('chunks preserve order with sequential indices', () => {
      const chunks = chunkFile('test.ts', testTsContent);
      
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    test('all lines are covered without gaps', () => {
      const chunks = chunkFile('test.ts', testTsContent);
      
      // Collect all line numbers
      const coveredLines = new Set<number>();
      for (const chunk of chunks) {
        for (let line = chunk.lineStart; line <= chunk.lineEnd; line++) {
          coveredLines.add(line);
        }
      }

      // Check coverage
      const totalLines = testTsContent.split('\n').length;
      expect(coveredLines.size).toBe(totalLines);
    });
  });
});

// Simple watcher test
describe('watcher', () => {
  test('createWatcher returns a watcher instance', async () => {
    const { createWatcher } = await import('./watcher.js');
    const { tmpdir } = await import('os');
    const { writeFileSync, unlinkSync, mkdirSync } = await import('fs');
    
    const testDir = `${tmpdir()}/watcher-test-${Date.now()}`;
    mkdirSync(testDir, { recursive: true });
    
    const watcher = createWatcher(testDir);
    expect(watcher).toBeDefined();
    
    // Cleanup
    await watcher.close();
  });
});
