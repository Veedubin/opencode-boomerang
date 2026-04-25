import { test, expect, describe } from 'vitest';
import { MetricsCollector } from '../../src/metrics/collector';

describe('Metrics Dashboard', () => {
  test('getAgentMetrics aggregates correctly', async () => {
    const collector = new MetricsCollector('.opencode/test-metrics.jsonl');

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
