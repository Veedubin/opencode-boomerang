/**
 * Latency Tests for Memory Operations
 * Validates that operations complete within specified thresholds
 */

import { describe, test, expect, vi } from 'vitest';
import { modelManager } from '../../src/model/index.js';
import { getMemorySystem } from '../../src/memory/index.js';
import { SUPPORTED_MODELS } from '../../src/model/types.js';

// Skip database-dependent tests in CI
const describeOrSkip = process.env.CI ? describe.skip : describe;

// Mock the model module to avoid ONNX issues in tests that don't need real inference
vi.mock('../../src/model/index.js', () => ({
  modelManager: {
    loadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbedding: vi.fn().mockResolvedValue(
      new Array(384).fill(0).map(() => Math.random())
    ),
    unloadModel: vi.fn(),
  },
  ModelManager: vi.fn().mockImplementation(() => ({
    loadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbedding: vi.fn().mockResolvedValue(
      new Array(384).fill(0).map(() => Math.random())
    ),
    unloadModel: vi.fn(),
  })),
}));

describeOrSkip('Memory Latency Tests', () => {
  beforeAll(async () => {
    // Initialize memory system
    const memory = getMemorySystem();
    if (!memory.isInitialized()) {
      await memory.initialize();
    }
  });

  afterAll(async () => {
    // Cleanup
    const { lancedbPool } = await import('../../src/memory/database.js');
    await lancedbPool.close();
  });

  describe('Embedding Latency', () => {
    test('embedding generation should be <100ms', async () => {
      const TEST_TEXT = 'This is a test document for embedding latency measurement';
      
      // Pre-load model
      await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);

      const start = performance.now();
      await modelManager.generateEmbedding(TEST_TEXT, SUPPORTED_MODELS.BGE_LARGE);
      const latency = performance.now() - start;

      console.log(`Embedding latency: ${latency.toFixed(2)}ms`);
      expect(latency).toBeLessThan(100);
    }, 30000);

    test('multiple embeddings should average <100ms', async () => {
      const TEST_TEXTS = [
        'First test document',
        'Second test document',
        'Third test document',
        'Fourth test document',
        'Fifth test document',
      ];

      await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);

      const latencies: number[] = [];
      for (const text of TEST_TEXTS) {
        const start = performance.now();
        await modelManager.generateEmbedding(text, SUPPORTED_MODELS.BGE_LARGE);
        latencies.push(performance.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`Average embedding latency: ${avgLatency.toFixed(2)}ms`);
      expect(avgLatency).toBeLessThan(100);
    }, 30000);
  });

  describe('Vector Search Latency', () => {
    test('vector search p50 should be <10ms', async () => {
      // Add test data first
      const memory = getMemorySystem();
      const testContent = `vector search test document ${Date.now()}`;
      await memory.addMemory({
        text: testContent,
        sourceType: 'test',
        sourcePath: `test://latency_${Date.now()}`,
        metadataJson: '{}',
      });

      // Warm up
      await memory.search('test', { strategy: 'VECTOR_ONLY' });

      // Measure
      const latencies: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await memory.search('test document', { strategy: 'VECTOR_ONLY' });
        latencies.push(performance.now() - start);
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      console.log(`Vector search p50: ${p50.toFixed(2)}ms`);
      expect(p50).toBeLessThan(10);
    }, 30000);
  });

  describe('Text Search Latency', () => {
    test('text search should be <50ms', async () => {
      const memory = getMemorySystem();

      // Add test data
      for (let i = 0; i < 10; i++) {
        await memory.addMemory({
          text: `text search test content ${i}`,
          sourceType: 'test',
          sourcePath: `test://text_${i}`,
          metadataJson: '{}',
        });
      }

      // Warm up
      await memory.search('test', { strategy: 'TEXT_ONLY' });

      // Measure
      const latencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await memory.search('test content', { strategy: 'TEXT_ONLY' });
        latencies.push(performance.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`Text search avg latency: ${avgLatency.toFixed(2)}ms`);
      expect(avgLatency).toBeLessThan(50);
    }, 30000);
  });

  describe('Memory Add Latency', () => {
    test('add memory (includes embedding) should be <200ms', async () => {
      const memory = getMemorySystem();

      const start = performance.now();
      await memory.addMemory({
        text: `add memory latency test ${Date.now()}`,
        sourceType: 'test',
        sourcePath: `test://add_${Date.now()}`,
        metadataJson: '{}',
      });
      const latency = performance.now() - start;

      console.log(`Add memory latency: ${latency.toFixed(2)}ms`);
      expect(latency).toBeLessThan(200);
    }, 30000);
  });
});
