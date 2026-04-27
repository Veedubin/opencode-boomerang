import { test, expect, describe, afterEach } from 'vitest';
import { MetricsCollector } from '../../src/metrics/collector';
import { unlink } from 'fs/promises';

describe('Metrics Dashboard', () => {
  const testFile = '.opencode/test-metrics-' + Date.now() + '.jsonl';

  afterEach(async () => {
    try {
      await unlink(testFile);
    } catch { /* ignore */ }
  });

  test('getAgentMetrics aggregates correctly', async () => {
    const collector = new MetricsCollector(testFile);

    collector.emit({ type: 'task.completed', sessionId: 'test', data: { agent: 'coder', duration: 1000 } });
    collector.emit({ type: 'task.completed', sessionId: 'test', data: { agent: 'coder', duration: 2000 } });
    collector.emit({ type: 'task.failed', sessionId: 'test', data: { agent: 'tester', duration: 500 } });

    await collector.flush();

    const metrics = await collector.getAgentMetrics();
    expect(metrics).toHaveLength(2);

    const coderMetrics = metrics.find(m => m.agentId === 'coder');
    expect(coderMetrics?.totalTasks).toBe(2);
    expect(coderMetrics?.successfulTasks).toBe(2);
    expect(coderMetrics?.avgDuration).toBe(1500);
  });
});
