import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
      'tests/performance/**',
      'src/tui/tui.test.ts',
    ],
    environment: 'node',
    globals: true,
    pool: 'vmForks',
    poolOptions: {
      vmForks: {
        maxForks: 1,
      },
    },
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
