/**
 * Hybrid File Chunker
 * - For .ts, .tsx, .js, .jsx, .py: semantic boundary chunking (functions, classes, methods)
 * - For other files: sliding window with overlap
 */

import type { ChunkConfig, FileChunk } from './types.js';
import { DEFAULT_CHUNK_CONFIG } from './types.js';

// Semantic patterns for different languages
const SEMANTIC_PATTERNS: Record<string, RegExp[]> = {
  // TypeScript/JavaScript patterns
  ts: [
    /^export\s+(?:default\s+)?(?:async\s+)?function\s+\w+/gm,
    /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+\w+/gm,
    /^export\s+(?:default\s+)?(?:const|let|var)\s+\w+\s*=/gm,
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/gm,
    /^(?:export\s+)?(?:abstract\s+)?class\s+\w+/gm,
    /^(?:public|private|protected|readonly)\s+(?:static\s+)?\w+\s*\(/gm,
    /^if\s*\(/gm,
    /^else\s+(?:if\s*\(|{)/gm,
    /^for\s*\(/gm,
    /^while\s*\(/gm,
    /^switch\s*\(/gm,
    /^case\s+/gm,
    /^default\s*:/gm,
    /^try\s*{/gm,
    /^catch\s*\(/gm,
    /^finally\s*{/gm,
  ],
  tsx: [
    /^export\s+(?:default\s+)?(?:async\s+)?function\s+\w+/gm,
    /^export\s+(?:default\s+)?(?:abstract\s+)?class\s+\w+/gm,
    /^export\s+(?:default\s+)?(?:const|let|var)\s+\w+\s*=/gm,
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/gm,
    /^(?:export\s+)?(?:abstract\s+)?class\s+\w+/gm,
    /^(?:public|private|protected|readonly)\s+(?:static\s+)?\w+\s*\(/gm,
    /^const\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>\s*[{(]/gm,
    /^return\s+/gm,
    /^if\s*\(/gm,
    /^else\s+(?:if\s*\(|{)/gm,
    /^for\s*\(/gm,
    /^while\s*\(/gm,
    /^switch\s*\(/gm,
    /^case\s+/gm,
    /^default\s*:/gm,
    /^try\s*{/gm,
    /^catch\s*\(/gm,
    /^finally\s*{/gm,
  ],
  js: [
    /^export\s+(?:default\s+)?(?:async\s+)?function\s+\w+/gm,
    /^export\s+(?:default\s+)?(?:const|let|var)\s+\w+\s*=/gm,
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/gm,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>\s*[{(]/gm,
    /^if\s*\(/gm,
    /^else\s+(?:if\s*\(|{)/gm,
    /^for\s*\(/gm,
    /^while\s*\(/gm,
    /^switch\s*\(/gm,
    /^case\s+/gm,
    /^default\s*:/gm,
    /^try\s*{/gm,
    /^catch\s*\(/gm,
    /^finally\s*{/gm,
  ],
  jsx: [
    /^export\s+(?:default\s+)?(?:async\s+)?function\s+\w+/gm,
    /^export\s+(?:default\s+)?(?:const|let|var)\s+\w+\s*=/gm,
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/gm,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>\s*[{(]/gm,
    /^return\s+/gm,
    /^if\s*\(/gm,
    /^else\s+(?:if\s*\(|{)/gm,
    /^for\s*\(/gm,
    /^while\s*\(/gm,
    /^switch\s*\(/gm,
    /^case\s+/gm,
    /^default\s*:/gm,
    /^try\s*{/gm,
    /^catch\s*\(/gm,
    /^finally\s*{/gm,
  ],
  // Python patterns
  py: [
    /^def\s+\w+\s*\(/gm,
    /^class\s+\w+\s*[:(]/gm,
    /^async\s+def\s+\w+/gm,
    /^if\s+__name__\s*==\s*['"]__main__['"]\s*:/gm,
    /^if\s+/gm,
    /^elif\s+/gm,
    /^else\s*:/gm,
    /^for\s+\w+\s+in\s+/gm,
    /^while\s+/gm,
    /^try\s*:/gm,
    /^except\s+/gm,
    /^finally\s*:/gm,
    /^with\s+\w+\s+as\s+/gm,
    /^@abstractmethod/gm,
    /^@staticmethod/gm,
    /^@classmethod/gm,
    /^@\w+\s*$/gm,
  ],
};

/**
 * Get file extension
 */
function getExt(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastDot > lastSlash) {
    return filePath.substring(lastDot + 1).toLowerCase();
  }
  return '';
}

/**
 * Count tokens (simple approximation: 4 chars per token)
 */
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into lines with original line numbers
 */
function getLines(content: string): string[] {
  return content.split('\n');
}

/**
 * Find semantic boundaries in content
 */
function findSemanticBoundaries(content: string, ext: string): number[] {
  const patterns = SEMANTIC_PATTERNS[ext] || [];
  const lines = getLines(content);
  const boundaries: number[] = [0]; // Start with first line

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number for this match
      const matchStart = match.index;
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1; // +1 for newline
        if (charCount > matchStart) {
          lineNum = i;
          break;
        }
      }
      if (!boundaries.includes(lineNum)) {
        boundaries.push(lineNum);
      }
    }
  }

  return boundaries.sort((a, b) => a - b);
}

/**
 * Chunk file at semantic boundaries for supported languages
 */
function chunkSemantic(
  content: string,
  config: ChunkConfig,
  ext: string
): FileChunk[] {
  const lines = getLines(content);
  const boundaries = findSemanticBoundaries(content, ext);
  const chunks: FileChunk[] = [];

  // If no semantic boundaries found, fall back to sliding window
  if (boundaries.length <= 1) {
    return chunkSlidingWindow(content, config);
  }

  // Group lines into chunks based on boundaries
  let currentChunkLines: string[] = [];
  let currentChunkStart = 0;
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    currentChunkLines.push(lines[i]);
    const currentTokens = countTokens(currentChunkLines.join('\n'));

    // Check if we've hit a semantic boundary or exceeded chunk size
    const nextBoundary = boundaries.find((b) => b > i);
    const atBoundary = nextBoundary !== undefined && i === nextBoundary - 1;
    const exceedsChunk = currentTokens > config.chunkSize;

    if (atBoundary || exceedsChunk || i === lines.length - 1) {
      if (currentChunkLines.length > 0) {
        const chunkContent = currentChunkLines.join('\n');
        chunks.push({
          content: chunkContent,
          lineStart: currentChunkStart + 1, // 1-indexed
          lineEnd: i + 1, // 1-indexed
          index: chunkIndex,
        });
        chunkIndex++;
        currentChunkLines = [];
        currentChunkStart = i + 1;
      }
    }
  }

  return chunks;
}

/**
 * Sliding window chunking for unsupported file types
 */
function chunkSlidingWindow(content: string, config: ChunkConfig): FileChunk[] {
  const lines = getLines(content);
  const chunks: FileChunk[] = [];

  // Calculate how many lines per chunk (approximate)
  const avgCharsPerLine = content.length / Math.max(lines.length, 1);
  const linesPerChunk = Math.max(
    1,
    Math.floor((config.chunkSize * 4) / avgCharsPerLine)
  );
  const overlapLines = Math.max(
    1,
    Math.floor((config.chunkOverlap * 4) / avgCharsPerLine)
  );

  let start = 0;
  let chunkIndex = 0;

  while (start < lines.length) {
    const end = Math.min(start + linesPerChunk, lines.length);
    const chunkLines = lines.slice(start, end);

    chunks.push({
      content: chunkLines.join('\n'),
      lineStart: start + 1, // 1-indexed
      lineEnd: end,
      index: chunkIndex,
    });

    chunkIndex++;
    start = end - overlapLines;

    // Ensure we make progress
    if (overlapLines >= linesPerChunk) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Chunk a file based on its content and language
 */
export function chunkFile(
  filePath: string,
  content: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): FileChunk[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const ext = getExt(filePath);
  const supportedExtensions = Object.keys(SEMANTIC_PATTERNS);

  if (supportedExtensions.includes(ext)) {
    return chunkSemantic(content, config, ext);
  }

  return chunkSlidingWindow(content, config);
}
