import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'tests/memory/search.test.ts',
      'tests/memory/operations.test.ts',
      'tests/memory/database.test.ts',
      'tests/mcp/server.test.ts',
      'tests/orchestrator.test.ts',
      'tests/plugin.test.ts',
      'src/memory/adapter.test.ts',
      'src/memory/index.test.ts',
      'src/memory/schema.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
      'tests/performance/**',
      'tests/context/**',
      'tests/metrics/**',
      'tests/protocol/**',
      'tests/project-index/**',
      'tests/tui/**',
      'tests/memory-service/**',
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
