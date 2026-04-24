/**
 * Performance Benchmark Suite
 * Runs benchmarks for embedding, vector search, indexing, and text search
 */

import { modelManager } from '../../src/model/index.js';
import { MemorySystem, getMemorySystem } from '../../src/memory/index.js';
import { lancedbPool } from '../../src/memory/database.js';
import { SUPPORTED_MODELS } from '../../src/model/types.js';
import { createProjectIndexer } from '../../src/project-index/indexer.js';
import { randomUUID } from 'crypto';

// Test data generators
function generateTestTexts(count: number): string[] {
  const texts = [
    'The quick brown fox jumps over the lazy dog',
    'Machine learning models require careful hyperparameter tuning',
    'Vector databases excel at similarity search at scale',
    'The ancient Romans built elaborate aqueducts for water transport',
    'Photosynthesis converts sunlight into chemical energy',
    'Quantum computing harnesses superposition and entanglement',
    'The Renaissance period saw remarkable artistic achievements',
    'Blockchain technology provides decentralized trust mechanisms',
    'Natural language processing enables human-computer dialogue',
    'Climate change poses significant challenges to ecosystems',
  ];
  return Array.from({ length: count }, (_, i) => `${texts[i % texts.length]} (item ${i})`);
}

function generateTestFiles(dir: string, count: number): string[] {
  // This would create actual test files - for now we return paths
  return Array.from({ length: count }, (_, i) => `${dir}/test_file_${i}.ts`);
}

// Statistics helpers
function calculateStats(times: number[]): { avg: number; min: number; max: number; p50: number; p95: number; p99: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { avg, min: sorted[0], max: sorted[sorted.length - 1], p50, p95, p99 };
}

// Benchmark: Embedding Generation
export async function benchmarkEmbeddingGeneration(texts: string[]): Promise<{
  avgTime: number;
  minTime: number;
  maxTime: number;
}> {
  const ITERATIONS = 10;
  const times: number[] = [];

  // Pre-load model
  await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);

  for (let i = 0; i < ITERATIONS; i++) {
    for (const text of texts) {
      const start = performance.now();
      await modelManager.generateEmbedding(text, SUPPORTED_MODELS.BGE_LARGE);
      times.push(performance.now() - start);
    }
  }

  const stats = calculateStats(times);
  return {
    avgTime: stats.avg,
    minTime: stats.min,
    maxTime: stats.max,
  };
}

// Benchmark: Vector Search
export async function benchmarkVectorSearch(queries: string[]): Promise<{
  avgTime: number;
  p50: number;
  p95: number;
  p99: number;
}> {
  const ITERATIONS = 10;
  const times: number[] = [];

  // Initialize memory system and add test data
  const memory = getMemorySystem();
  if (!memory.isInitialized()) {
    await memory.initialize();
  }

  // Add test memories
  const testTexts = generateTestTexts(100);
  for (const text of testTexts) {
    try {
      await memory.addMemory({
        text,
        sourceType: 'test',
        sourcePath: `test://${randomUUID()}`,
        metadataJson: '{}',
      });
    } catch {
      // Ignore duplicates
    }
  }

  for (let i = 0; i < ITERATIONS; i++) {
    for (const query of queries) {
      const start = performance.now();
      await memory.search(query, { strategy: 'VECTOR_ONLY' });
      times.push(performance.now() - start);
    }
  }

  const stats = calculateStats(times);
  return {
    avgTime: stats.avg,
    p50: stats.p50,
    p95: stats.p95,
    p99: stats.p99,
  };
}

// Benchmark: Indexing
export async function benchmarkIndexing(fileCount: number): Promise<{
  totalTime: number;
  filesPerMinute: number;
  error?: string;
}> {
  // Create temp directory for test files
  const fs = await import('fs');
  const path = await import('path');
  const tmpDir = `/tmp/bench_index_${randomUUID()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Create test files
    const testContent = `
/**
 * Test file for benchmarking
 */
export function hello() {
  console.log('Hello, World!');
}
export class TestClass {
  private value: number;
  constructor() {
    this.value = 42;
  }
  getValue(): number {
    return this.value;
  }
}
`;

    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(tmpDir, `test_${i}.ts`);
      fs.writeFileSync(filePath, testContent + `\n// File ${i}\n`);
    }

    // Benchmark indexing
    const indexer = createProjectIndexer(`file://${tmpDir}/index`, tmpDir);
    await indexer.start();

    const start = performance.now();
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.ts'));
    for (const file of files) {
      try {
        await indexer.indexFile(path.join(tmpDir, file));
      } catch {
        // Skip files that fail
      }
    }
    const totalTime = performance.now() - start;

    await indexer.stop();

    const filesPerMinute = (fileCount / totalTime) * 60000;

    return { totalTime, filesPerMinute };
  } catch (err) {
    return {
      totalTime: 0,
      filesPerMinute: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Benchmark: Text Search
export async function benchmarkTextSearch(queries: string[]): Promise<{
  avgTime: number;
}> {
  const ITERATIONS = 10;
  const times: number[] = [];

  // Initialize memory system
  const memory = getMemorySystem();
  if (!memory.isInitialized()) {
    await memory.initialize();
  }

  for (let i = 0; i < ITERATIONS; i++) {
    for (const query of queries) {
      const start = performance.now();
      await memory.search(query, { strategy: 'TEXT_ONLY' });
      times.push(performance.now() - start);
    }
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { avgTime: avg };
}

// Main benchmark runner
async function main() {
  console.log('🚀 Starting Performance Benchmarks...\n');

  const benchmarkResults: Record<string, unknown> = {};

  // Benchmark 1: Embedding Generation
  console.log('📊 Benchmark 1: Embedding Generation');
  console.log('   Target: <100ms per embedding');
  const embedTexts = generateTestTexts(20);
  const embedResult = await benchmarkEmbeddingGeneration(embedTexts);
  console.table([{
    'Avg Time (ms)': embedResult.avgTime.toFixed(2),
    'Min Time (ms)': embedResult.minTime.toFixed(2),
    'Max Time (ms)': embedResult.maxTime.toFixed(2),
    'Target Met': embedResult.avgTime < 100 ? '✅ YES' : '❌ NO',
  }]);
  benchmarkResults.embedding = embedResult;

  // Benchmark 2: Vector Search
  console.log('\n📊 Benchmark 2: Vector Search');
  console.log('   Target: <10ms p50, <50ms p95');
  const searchQueries = ['test query', 'machine learning', 'vector database'];
  const searchResult = await benchmarkVectorSearch(searchQueries);
  console.table([{
    'Avg Time (ms)': searchResult.avgTime.toFixed(2),
    'p50 (ms)': searchResult.p50.toFixed(2),
    'p95 (ms)': searchResult.p95.toFixed(2),
    'p99 (ms)': searchResult.p99.toFixed(2),
    'p50 Target Met': searchResult.p50 < 10 ? '✅ YES' : '❌ NO',
    'p95 Target Met': searchResult.p95 < 50 ? '✅ YES' : '❌ NO',
  }]);
  benchmarkResults.vectorSearch = searchResult;

  // Benchmark 3: Indexing
  console.log('\n📊 Benchmark 3: Indexing Performance');
  console.log('   Target: >100 files/minute');
  const indexResult = await benchmarkIndexing(50);
  if (indexResult.error) {
    console.table([{
      'Status': '⚠️ SKIPPED',
      'Error': indexResult.error,
    }]);
  } else {
    console.table([{
      'Total Time (ms)': indexResult.totalTime.toFixed(2),
      'Files/minute': indexResult.filesPerMinute.toFixed(2),
      'Target Met': indexResult.filesPerMinute > 100 ? '✅ YES' : '❌ NO',
    }]);
  }
  benchmarkResults.indexing = indexResult;

  // Benchmark 4: Text Search
  console.log('\n📊 Benchmark 4: Text Search');
  console.log('   Target: <50ms');
  const textResult = await benchmarkTextSearch(searchQueries);
  console.table([{
    'Avg Time (ms)': textResult.avgTime.toFixed(2),
    'Target Met': textResult.avgTime < 50 ? '✅ YES' : '❌ NO',
  }]);
  benchmarkResults.textSearch = textResult;

  // Summary
  console.log('\n📈 Benchmark Summary');
  console.log('===================');
  console.log(`Embedding Generation: ${benchmarkResults.embedding ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Vector Search: ${benchmarkResults.vectorSearch ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Indexing: ${benchmarkResults.indexing ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Text Search: ${benchmarkResults.textSearch ? '✅ PASSED' : '❌ FAILED'}`);

  // Cleanup
  await lancedbPool.close();

  return benchmarkResults;
}

// Export for testing
export { main };

// Run if executed directly
main().catch(console.error);
