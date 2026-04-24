/**
 * Tests for file watcher with mocked chokidar
 */

import { test, expect, describe, beforeEach, vi } from 'vitest';

// Use vi.hoisted for proper hoisting
const { mockWatcher, mockChokidar } = vi.hoisted(() => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
    add: vi.fn(),
    unwatch: vi.fn(),
  };

  const mockChokidar = {
    watch: vi.fn().mockReturnValue(mockWatcher),
  };

  return { mockWatcher, mockChokidar };
});

// Mock chokidar
vi.mock('chokidar', () => ({
  default: mockChokidar,
}));

// Import after mocks
import { createWatcher, getTrackedFiles } from '../../src/project-index/watcher';

describe('createWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    test('creates watcher with default config', () => {
      const watcher = createWatcher('/test/path');

      expect(mockChokidar.watch).toHaveBeenCalled();
      expect(watcher).toBeDefined();
    });

    test('creates watcher with custom include patterns', () => {
      const include = ['**/*.ts', '**/*.js'];
      createWatcher('/test/path', { include });

      expect(mockChokidar.watch).toHaveBeenCalledWith(include, expect.any(Object));
    });

    test('creates watcher with custom exclude patterns', () => {
      const exclude = ['node_modules', 'dist', '*.log'];
      createWatcher('/test/path', { exclude });

      const watchCall = mockChokidar.watch.mock.calls[0];
      const watcherOptions = watchCall[1];
      expect(watcherOptions.ignored).toContain('node_modules');
    });

    test('returns FSWatcher instance', () => {
      const watcher = createWatcher('/test/path');
      expect(watcher).toBe(mockWatcher);
    });
  });

  describe('event handlers', () => {
    test('registers add, change, unlink, and error handlers', () => {
      createWatcher('/test/path');

      const handlers = mockWatcher.on.mock.calls.map(call => call[0]);
      
      expect(handlers).toContain('add');
      expect(handlers).toContain('change');
      expect(handlers).toContain('unlink');
      expect(handlers).toContain('error');
    });
  });

  describe('exclude patterns', () => {
    test('passes exclude patterns to chokidar', () => {
      const exclude = ['*.log', '*.tmp'];
      createWatcher('/test/path', { exclude });

      const watchCall = mockChokidar.watch.mock.calls[0];
      const watcherOptions = watchCall[1];

      expect(watcherOptions.ignored).toContain('*.log');
    });

    test('uses default exclude patterns when not specified', () => {
      createWatcher('/test/path');

      const watchCall = mockChokidar.watch.mock.calls[0];
      const watcherOptions = watchCall[1];

      expect(watcherOptions.ignored).toContain('node_modules');
    });
  });

  describe('watcher options', () => {
    test('sets persistent: true', () => {
      createWatcher('/test/path');

      const watchCall = mockChokidar.watch.mock.calls[0];
      const watcherOptions = watchCall[1];

      expect(watcherOptions.persistent).toBe(true);
    });

    test('sets ignoreInitial: true', () => {
      createWatcher('/test/path');

      const watchCall = mockChokidar.watch.mock.calls[0];
      const watcherOptions = watchCall[1];

      expect(watcherOptions.ignoreInitial).toBe(true);
    });

    test('configures awaitWriteFinish', () => {
      createWatcher('/test/path');

      const watchCall = mockChokidar.watch.mock.calls[0];
      const watcherOptions = watchCall[1];

      expect(watcherOptions.awaitWriteFinish).toBeDefined();
      expect(watcherOptions.awaitWriteFinish.stabilityThreshold).toBe(100);
    });
  });

  describe('getTrackedFiles', () => {
    test('returns empty array (workaround limitation)', () => {
      const watcher = createWatcher('/test/path');
      const files = getTrackedFiles(watcher);

      expect(files).toEqual([]);
    });
  });

  describe('cleanup', () => {
    test('watcher close is called on close', async () => {
      const watcher = createWatcher('/test/path');

      await watcher.close();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });
});
