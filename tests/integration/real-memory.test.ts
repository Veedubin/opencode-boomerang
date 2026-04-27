import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMemorySystem } from '../../src/memory/index.js';
import { lancedbPool } from '../../src/memory/database.js';

// Mock the model module to avoid ONNX issues
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

describe('Real Memory Integration', () => {
  beforeEach(async () => {
    await lancedbPool.connect('memory://real-test');
  });

  afterEach(async () => {
    await lancedbPool.close();
  });

  test('addMemory → queryMemories roundtrip', async () => {
    const memorySystem = getMemorySystem();
    if (!memorySystem.isInitialized()) {
      await memorySystem.initialize('memory://real-test');
    }

    const added = await memorySystem.addMemory({
      text: 'Integration test memory about database schemas',
      sourceType: 'manual',
      sourcePath: '/test/integration',
      sessionId: 'test-session',
      metadataJson: '{}',
    });

    expect(added.id).toBeDefined();

    const results = await memorySystem.search('database schemas', {
      topK: 5,
      threshold: 0.1,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.text).toBe('Integration test memory about database schemas');
  });
});