import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { getMemorySystem } from '../../src/memory/index.js';
import { lancedbPool } from '../../src/memory/database.js';

describe('Real Memory Integration', () => {
  beforeEach(async () => {
    await lancedbPool.connect('memory://real-test');
  });

  afterEach(async () => {
    await lancedbPool.closeAll();
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