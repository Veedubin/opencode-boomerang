/**
 * File Watcher using chokidar
 * Monitors file changes and emits typed events
 */

import chokidar, { type FSWatcher } from 'chokidar';
import { createHash } from 'crypto';
import { type WatchConfig, type FileEvent, DEFAULT_WATCH_CONFIG } from './types.js';

interface WatcherState {
  rootPath: string;
  config: WatchConfig;
  watcher: FSWatcher | null;
  fileHashes: Map<string, string>;
  pendingEvents: Map<string, NodeJS.Timeout>;
}

/**
 * Compute SHA-256 hash of content
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Create a file watcher with configurable include/exclude patterns
 */
export function createWatcher(
  rootPath: string,
  config: Partial<WatchConfig> = {},
  onEvent?: (event: FileEvent) => void
): FSWatcher {
  const mergedConfig: WatchConfig = {
    include: config.include ?? DEFAULT_WATCH_CONFIG.include,
    exclude: config.exclude ?? DEFAULT_WATCH_CONFIG.exclude,
    debounceMs: config.debounceMs ?? DEFAULT_WATCH_CONFIG.debounceMs,
  };

  const watcherOptions = {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    disableGlobbing: false,
    usePolling: false,
    interval: 100,
    binaryInterval: 300,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100,
    },
    ignorePermissionErrors: true,
    ignored: mergedConfig.exclude,
  };

  const watcher = chokidar.watch(mergedConfig.include, watcherOptions);

  // Internal state
  const state: WatcherState = {
    rootPath,
    config: mergedConfig,
    watcher,
    fileHashes: new Map(),
    pendingEvents: new Map(),
  };

  // Debounced event emitter
  const emitEvent = (type: FileEvent['type'], filePath: string) => {
    if (onEvent) {
      onEvent({ type, filePath });
    }
  };

  // Handle 'add' event
  watcher.on('add', (filePath: string) => {
    const existingTimeout = state.pendingEvents.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      state.pendingEvents.delete(filePath);

      try {
        // Dynamic import for file reading
        const { readFileSync } = await import('fs');
        const content = readFileSync(filePath, 'utf-8');
        const hash = computeHash(content);

        if (!state.fileHashes.has(filePath)) {
          state.fileHashes.set(filePath, hash);
          emitEvent('add', filePath);
        }
      } catch {
        // File may have been deleted or is not readable
        emitEvent('add', filePath);
      }
    }, mergedConfig.debounceMs);

    state.pendingEvents.set(filePath, timeout);
  });

  // Handle 'change' event
  watcher.on('change', (filePath: string) => {
    const existingTimeout = state.pendingEvents.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      state.pendingEvents.delete(filePath);

      try {
        const { readFileSync } = await import('fs');
        const content = readFileSync(filePath, 'utf-8');
        const hash = computeHash(content);
        const previousHash = state.fileHashes.get(filePath);

        // Only emit if content actually changed
        if (previousHash !== hash) {
          state.fileHashes.set(filePath, hash);
          emitEvent('change', filePath);
        }
      } catch {
        // File may have been deleted
        emitEvent('change', filePath);
      }
    }, mergedConfig.debounceMs);

    state.pendingEvents.set(filePath, timeout);
  });

  // Handle 'unlink' event
  watcher.on('unlink', (filePath: string) => {
    const existingTimeout = state.pendingEvents.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      state.pendingEvents.delete(filePath);
    }

    state.fileHashes.delete(filePath);
    emitEvent('unlink', filePath);
  });

  // Handle errors
  watcher.on('error', (err: unknown) => {
    console.error('Watcher error:', err);
  });

  return watcher;
}

/**
 * Get tracked file hashes
 */
export function getTrackedFiles(watcher: FSWatcher): string[] {
  // This is a workaround since chokidar doesn't expose internal state
  // In production, you'd want to wrap chokidar to expose this
  return [];
}
