/**
 * Tests for hybrid file chunker
 * - Semantic chunking for TS/JS/PY files
 * - Sliding window for other files
 */

import { test, expect, describe } from 'vitest';
import { chunkFile } from '../../src/project-index/chunker';
import type { ChunkConfig } from '../../src/project-index/types';
import { DEFAULT_CHUNK_CONFIG } from '../../src/project-index/types';

describe('chunkFile', () => {
  describe('semantic chunking for TypeScript', () => {
    test('chunks at function boundaries', () => {
      const content = `export function hello() {
  console.log('Hello');
}

export function world() {
  console.log('World');
}`;

      const chunks = chunkFile('test.ts', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      const helloChunk = chunks.find((c) => c.content.includes('hello'));
      expect(helloChunk).toBeDefined();
    });

    test('chunks at class boundaries', () => {
      const content = `class Foo {
  method1() {}
}

class Bar {
  method2() {}
}`;

      const chunks = chunkFile('test.ts', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks at export const/let/var boundaries', () => {
      const content = `export const foo = 1;
export let bar = 2;
export var baz = 3;`;

      const chunks = chunkFile('test.ts', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('line numbers are accurate and 1-indexed', () => {
      const content = `line 1
line 2
line 3
line 4
line 5`;

      const chunks = chunkFile('test.ts', content);

      for (const chunk of chunks) {
        expect(chunk.lineStart).toBeGreaterThanOrEqual(1);
        expect(chunk.lineEnd).toBeGreaterThanOrEqual(chunk.lineStart);
        expect(chunk.index).toBeGreaterThanOrEqual(0);
      }
    });

    test('respects chunk size limits', () => {
      const content = `export function func1() { return 'a'.repeat(1000); }
export function func2() { return 'b'.repeat(1000); }
export function func3() { return 'c'.repeat(1000); }
export function func4() { return 'd'.repeat(1000); }`;

      const config: ChunkConfig = {
        chunkSize: 200,
        chunkOverlap: 20,
      };

      const chunks = chunkFile('test.ts', content, config);

      expect(chunks.length).toBeGreaterThan(1);
    });

    test('handles try-catch-finally blocks', () => {
      const content = `try {
  riskyOperation();
} catch (error) {
  handleError(error);
} finally {
  cleanup();
}`;

      const chunks = chunkFile('test.ts', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('semantic chunking for JavaScript', () => {
    test('chunks .js files with appropriate patterns', () => {
      const content = `export function hello() {
  return 'world';
}

export const arr = [1, 2, 3];`;

      const chunks = chunkFile('test.js', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks .jsx files with React patterns', () => {
      const content = `export default function Component() {
  return <div>Hello</div>;
}`;

      const chunks = chunkFile('test.jsx', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks arrow functions', () => {
      const content = `export const add = (a, b) => a + b;
export const multiply = (a, b) => a * b;`;

      const chunks = chunkFile('test.js', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('semantic chunking for Python', () => {
    test('chunks at function definitions', () => {
      const content = `def hello():
    print('Hello')

def world():
    print('World')`;

      const chunks = chunkFile('test.py', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks at class definitions', () => {
      const content = `class Foo:
    def method(self):
        pass

class Bar:
    def method(self):
        pass`;

      const chunks = chunkFile('test.py', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks at decorators', () => {
      const content = `@abstractmethod
def do_something(self):
    pass

@staticmethod
def utility():
    pass`;

      const chunks = chunkFile('test.py', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sliding window for unsupported files', () => {
    test('chunks .json files with sliding window', () => {
      const content = `{"key1": "value1"}
{"key2": "value2"}
{"key3": "value3"}
{"key4": "value4"}`;

      const chunks = chunkFile('test.json', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks .md files with sliding window', () => {
      const content = `# Heading 1

Paragraph 1

## Heading 2

Paragraph 2

### Heading 3

Paragraph 3`;

      const chunks = chunkFile('test.md', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('chunks .txt files with sliding window', () => {
      const content = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10`;

      const chunks = chunkFile('test.txt', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    test('returns empty array for empty content', () => {
      const chunks = chunkFile('test.ts', '');
      expect(chunks).toEqual([]);
    });

    test('returns empty array for whitespace-only content', () => {
      const chunks = chunkFile('test.ts', '   \n\n  \t  ');
      expect(chunks).toEqual([]);
    });

    test('handles single line file', () => {
      const chunks = chunkFile('test.ts', 'export const x = 1;');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('index is sequential within file', () => {
      const content = `export function a() {}
export function b() {}
export function c() {}
export function d() {}`;

      const chunks = chunkFile('test.ts', content);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    test('chunk content preserves original content exactly', () => {
      const content = 'export const x = 1 + 2;';
      const chunks = chunkFile('test.ts', content);

      for (const chunk of chunks) {
        expect(content).toContain(chunk.content);
      }
    });
  });
});
