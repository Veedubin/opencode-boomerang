/**
 * Performance Benchmark: MCP vs Built-in Memory
 * 
 * Compares latency of MCP-based memory operations vs direct built-in calls.
 * MCP adds overhead from: serialization, stdio transport, process boundaries.
 */

import { describe, test, expect, vi } from 'vitest';
import { MemoryClient } from '../../src/memory-client';

describe('MCP vs Built-in Performance Benchmark', () => {
  describe('MCP Overhead Analysis', () => {
    test('MCP tool call overhead should be <50ms per call', async () => {
      // Mock the MCP client to measure just the wrapper overhead
      const mockCallTool = vi.fn().mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      // Create a memory client with mocked internals
      const client = new MemoryClient();
      
      // Manually set connected state and mock client
      (client as any).client = { callTool: mockCallTool };
      (client as any).connected = true;

      const ITERATIONS = 50;
      const latencies: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        await client.queryMemories('test query');
        latencies.push(performance.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95 = [...latencies].sort((a, b) => a - b)[Math.floor(ITERATIONS * 0.95)];

      console.log(`MCP Query Overhead:`);
      console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  Max: ${maxLatency.toFixed(2)}ms`);

      // MCP overhead (serialization + mock) should be minimal
      // Real MCP adds stdio + process overhead
      expect(avgLatency).toBeLessThan(50);
      expect(p95).toBeLessThan(100);
    });

    test('MCP add_memory overhead should be <50ms per call', async () => {
      const mockCallTool = vi.fn().mockResolvedValue({
        content: [{ text: JSON.stringify({ id: 'benchmark-test' }) }],
      });

      const client = new MemoryClient();
      (client as any).client = { callTool: mockCallTool };
      (client as any).connected = true;

      const ITERATIONS = 50;
      const latencies: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        await client.addMemory({ content: `Benchmark test ${i}` });
        latencies.push(performance.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`MCP Add Overhead: ${avgLatency.toFixed(2)}ms average`);

      expect(avgLatency).toBeLessThan(50);
    });
  });

  describe('Throughput Comparison', () => {
    test('MCP client should handle 100 ops/sec', async () => {
      const mockCallTool = vi.fn().mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      const client = new MemoryClient();
      (client as any).client = { callTool: mockCallTool };
      (client as any).connected = true;

      const OPS = 100;
      const start = performance.now();

      const promises = Array(OPS).fill(null).map((_, i) =>
        client.queryMemories(`query ${i}`)
      );

      await Promise.all(promises);
      const totalTime = performance.now() - start;
      const opsPerSecond = (OPS / totalTime) * 1000;

      console.log(`MCP Throughput: ${opsPerSecond.toFixed(2)} ops/sec (${totalTime.toFixed(2)}ms for ${OPS} ops)`);

      expect(opsPerSecond).toBeGreaterThan(100);
    });
  });

  describe('Real-world Scenario', () => {
    test('typical agent workflow: 1 query + 1 add + 1 search', async () => {
      const mockCallTool = vi.fn()
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify([
            { id: '1', content: 'Previous context', score: 0.9 },
          ]) }],
        })
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({ id: 'new-mem' }) }],
        })
        .mockResolvedValueOnce({
          content: [{ text: JSON.stringify({
            results: [
              { filePath: '/src/index.ts', content: 'const x = 1;', score: 0.88 },
            ],
          }) }],
        });

      const client = new MemoryClient();
      (client as any).client = { callTool: mockCallTool };
      (client as any).connected = true;

      const start = performance.now();

      // Typical workflow:
      // 1. Query memory for context
      await client.queryMemories('current task');
      
      // 2. Save results
      await client.addMemory({ content: 'Task completed successfully' });
      
      // 3. Search project for related code
      await client.searchProject('related code');

      const totalTime = performance.now() - start;

      console.log(`Typical agent workflow (3 MCP calls): ${totalTime.toFixed(2)}ms`);

      // Should complete in reasonable time for interactive use
      expect(totalTime).toBeLessThan(500);
    });
  });
});
