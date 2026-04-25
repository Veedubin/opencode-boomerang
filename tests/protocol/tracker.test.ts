import { test, expect, describe } from 'vitest';
import { ProtocolTracker } from '../../src/protocol/tracker';

describe('ProtocolTracker', () => {
  test('records tool calls and sets checkpoints', () => {
    const tracker = new ProtocolTracker();
    tracker.recordToolCall('test-session', 'memory.queryMemories', { query: 'test' });
    
    const checkpoints = tracker.getCheckpoints('test-session');
    expect(checkpoints.memoryQueried).toBe(true);
  });

  test('records memory saves', () => {
    const tracker = new ProtocolTracker();
    tracker.recordToolCall('test-session', 'memory.addMemory', {});
    
    const checkpoints = tracker.getCheckpoints('test-session');
    expect(checkpoints.memorySaved).toBe(true);
  });
});