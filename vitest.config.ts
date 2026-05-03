import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'tests/mcp/server.test.ts',
      'tests/orchestrator.test.ts',
      'tests/plugin.test.ts',
      'tests/protocol/**',
      'tests/execution/**',
      'src/memory/adapter.test.ts',
      'src/memory/index.test.ts',
      'src/memory/schema.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Excluded due to referencing deleted components:
      // - AgentSpawner (deleted)
      // - ProtocolTracker (deleted)
      // - ContextMonitor (deleted)
      // - TaskExecutor (deleted)
      // - scoring-router (deleted)
      // - memory-service.ts (replaced by direct memory integration)
      'tests/integration/**',
      'tests/performance/**',
      'tests/context/**',
      'tests/metrics/**',
      'tests/project-index/**',
      'tests/memory-service/**',
      'tests/tui/**',
      'src/tui/**',
      'src/model/**',
      'src/project-index/**',
    ],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});