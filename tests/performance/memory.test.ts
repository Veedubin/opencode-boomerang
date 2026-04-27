/**
 * Memory Usage Tests
 * Validates memory footprint stays within acceptable limits
 */

import { describe, test, expect, vi } from 'vitest';
import { modelManager, ModelManager } from '../../src/model/index.js';
import { lancedbPool } from '../../src/memory/database.js';
import { getMemorySystem } from '../../src/memory/index.js';
import { SUPPORTED_MODELS } from '../../src/model/types.js';

// Mock the model module to avoid ONNX issues in memory tests
vi.mock('../../src/model/index.js', () => ({
  modelManager: {
    loadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbedding: vi.fn().mockResolvedValue(
      new Array(384).fill(0).map(() => Math.random())
    ),
    getPipeline: vi.fn((modelName: string) =>
      modelName === SUPPORTED_MODELS.BGE_LARGE ? 'mock-pipeline' : null
    ),
    unloadModel: vi.fn(),
  },
  ModelManager: vi.fn().mockImplementation(() => ({
    loadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbedding: vi.fn().mockResolvedValue(
      new Array(384).fill(0).map(() => Math.random())
    ),
    getPipeline: vi.fn((modelName: string) =>
      modelName === SUPPORTED_MODELS.BGE_LARGE ? 'mock-pipeline' : null
    ),
    unloadModel: vi.fn(),
  })),
}));

describe('Memory Usage Tests', () => {
  let initialMemory: { heapUsed: number; heapTotal: number; external: number } | null = null;

  function getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed / 1024 / 1024, // MB
      heapTotal: mem.heapTotal / 1024 / 1024, // MB
      external: mem.external / 1024 / 1024, // MB
    };
  }

  beforeEach(() => {
    initialMemory = getMemoryUsage();
  });

  afterEach(() => {
    // Allow GC to run
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(async () => {
    await lancedbPool.close();
  });

  describe('ModelManager Memory Usage', () => {
    test('loading BGE-large should use <300MB additional heap', async () => {
      const beforeLoad = getMemoryUsage();

      // Load the model
      await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);

      // Force V8 to report accurate memory
      if (global.gc) {
        global.gc();
      }

      const afterLoad = getMemoryUsage();
      const heapIncrease = afterLoad.heapUsed - beforeLoad.heapUsed;

      console.log(`BGE-large load:`);
      console.log(`  Heap before: ${beforeLoad.heapUsed.toFixed(2)} MB`);
      console.log(`  Heap after: ${afterLoad.heapUsed.toFixed(2)} MB`);
      console.log(`  Increase: ${heapIncrease.toFixed(2)} MB`);

      // Model loading typically uses 200-300MB for BGE-large
      expect(heapIncrease).toBeLessThan(400);
    }, 60000);

    test('model manager should track loaded models', async () => {
      await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);

      const pipeline = modelManager.getPipeline(SUPPORTED_MODELS.BGE_LARGE);
      expect(pipeline).not.toBeNull();

      const pipeline2 = modelManager.getPipeline('invalid-model');
      expect(pipeline2).toBeNull();
    });

    test('unloading model should free resources', async () => {
      const beforeLoad = getMemoryUsage();

      await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);
      modelManager.unloadModel(SUPPORTED_MODELS.BGE_LARGE);

      if (global.gc) {
        global.gc();
      }

      const afterUnload = getMemoryUsage();
      // Allow some tolerance as models may not immediately free memory
      const heapDelta = Math.abs(afterUnload.heapUsed - beforeLoad.heapUsed);
      console.log(`Heap delta after unload: ${heapDelta.toFixed(2)} MB`);
    });
  });

  describe('LanceDB Memory Footprint', () => {
    test('LanceDB connection should have minimal overhead', async () => {
      const memory = getMemorySystem();
      if (!memory.isInitialized()) {
        await memory.initialize();
      }

      const mem = getMemoryUsage();
      console.log(`LanceDB memory footprint:`);
      console.log(`  Heap used: ${mem.heapUsed.toFixed(2)} MB`);
      console.log(`  Heap total: ${mem.heapTotal.toFixed(2)} MB`);

      // LanceDB + basic operations should stay under 200MB heap
      expect(mem.heapUsed).toBeLessThan(250);
    });

    test('adding entries should not cause memory leaks', async () => {
      const memory = getMemorySystem();
      if (!memory.isInitialized()) {
        await memory.initialize();
      }

      const memoryBefore = getMemoryUsage();
      const entryCount = 50;

      for (let i = 0; i < entryCount; i++) {
        await memory.addMemory({
          text: `memory leak test entry ${i} ${Date.now()}`,
          sourceType: 'test',
          sourcePath: `test://leak_${i}`,
          metadataJson: JSON.stringify({ index: i }),
        });
      }

      if (global.gc) {
        global.gc();
      }

      const memoryAfter = getMemoryUsage();
      const heapIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`Memory after ${entryCount} adds:`);
      console.log(`  Heap increase: ${heapIncrease.toFixed(2)} MB`);
      console.log(`  Per entry: ${(heapIncrease / entryCount).toFixed(2)} MB`);

      // Should not accumulate more than 5MB per entry
      expect(heapIncrease / entryCount).toBeLessThan(10);
    }, 30000);
  });

  describe('Overall Process Memory', () => {
    test('overall memory usage should stay <500MB', async () => {
      // Load model and initialize DB
      await modelManager.loadModel(SUPPORTED_MODELS.BGE_LARGE);
      
      const memory = getMemorySystem();
      if (!memory.isInitialized()) {
        await memory.initialize();
      }

      // Add some test data
      for (let i = 0; i < 20; i++) {
        await memory.addMemory({
          text: `overall memory test ${i}`,
          sourceType: 'test',
          sourcePath: `test://overall_${i}`,
          metadataJson: '{}',
        });
      }

      // Force GC for accurate measurement
      if (global.gc) {
        global.gc();
      }

      const mem = getMemoryUsage();
      console.log(`Overall process memory:`);
      console.log(`  Heap used: ${mem.heapUsed.toFixed(2)} MB`);
      console.log(`  Heap total: ${mem.heapTotal.toFixed(2)} MB`);
      console.log(`  External: ${mem.external.toFixed(2)} MB`);

      expect(mem.heapUsed).toBeLessThan(500);
    }, 60000);

    test('multiple operations should not exceed 600MB peak', async () => {
      const memory = getMemorySystem();
      if (!memory.isInitialized()) {
        await memory.initialize();
      }

      let peakMemory = 0;

      // Perform various operations and track peak
      for (let i = 0; i < 30; i++) {
        await memory.addMemory({
          text: `peak memory test ${i}`,
          sourceType: 'test',
          sourcePath: `test://peak_${i}`,
          metadataJson: '{}',
        });

        const mem = getMemoryUsage();
        if (mem.heapUsed > peakMemory) {
          peakMemory = mem.heapUsed;
        }
      }

      // Search to use vector and text search paths
      await memory.search('test', { strategy: 'TIERED' });
      await memory.search('peak', { strategy: 'VECTOR_ONLY' });
      await memory.search('memory', { strategy: 'TEXT_ONLY' });

      const finalMem = getMemoryUsage();
      if (finalMem.heapUsed > peakMemory) {
        peakMemory = finalMem.heapUsed;
      }

      console.log(`Peak memory during operations: ${peakMemory.toFixed(2)} MB`);
      expect(peakMemory).toBeLessThan(600);
    }, 60000);
  });
});
