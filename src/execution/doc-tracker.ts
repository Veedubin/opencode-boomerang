/**
 * Documentation Tracker
 * 
 * Tracks documentation updates using SHA-256 hash comparison.
 * Part of Protocol Enforcement v4.0.
 */

import { createHash } from 'node:crypto';
import { readFile, stat, access } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { cwd } from 'node:process';

export interface DocChange {
  filePath: string;
  beforeHash: string;
  afterHash: string;
  changed: boolean;
}

export interface DocTrackerConfig {
  trackedFiles: string[];
  sessionStoragePath?: string;
  rootPath?: string;
}

const DEFAULT_TRACKED_FILES = [
  'AGENTS.md',
  'TASKS.md',
  'README.md',
  'CHANGELOG.md',
  'HANDOFF.md',
];

const DEFAULT_CONFIG: DocTrackerConfig = {
  trackedFiles: DEFAULT_TRACKED_FILES,
  rootPath: process.cwd(),
};

/**
 * Documentation change tracker using file hash comparison
 */
export class DocTracker {
  private config: DocTrackerConfig;
  private snapshots: Map<string, Map<string, string>> = new Map(); // sessionId -> file -> hash

  constructor(config?: Partial<DocTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Take a snapshot of current file hashes
   */
  async snapshot(sessionId: string, files?: string[]): Promise<void> {
    const filesToTrack = files ?? this.config.trackedFiles;
    const snapshot = new Map<string, string>();

    for (const file of filesToTrack) {
      const fullPath = this.resolvePath(file);
      if (await this.fileExists(fullPath)) {
        try {
          const hash = await this.computeHash(fullPath);
          snapshot.set(file, hash);
        } catch (error) {
          console.warn(`[DocTracker] Failed to hash ${file}:`, error instanceof Error ? error.message : error);
        }
      }
    }

    this.snapshots.set(sessionId, snapshot);
  }

  /**
   * Check which files have changed since snapshot
   */
  async checkChanges(sessionId: string): Promise<DocChange[]> {
    const previousSnapshot = this.snapshots.get(sessionId);
    if (!previousSnapshot) {
      // No snapshot, return empty - nothing to compare
      return [];
    }

    const changes: DocChange[] = [];
    const currentFiles = this.config.trackedFiles;

    for (const file of currentFiles) {
      const fullPath = this.resolvePath(file);
      const previousHash = previousSnapshot.get(file);
      
      if (!(await this.fileExists(fullPath))) {
        // File was deleted or doesn't exist
        if (previousHash) {
          changes.push({
            filePath: file,
            beforeHash: previousHash,
            afterHash: '',
            changed: true,
          });
        }
        continue;
      }

      try {
        const currentHash = await this.computeHash(fullPath);
        const beforeHash = previousHash ?? '';
        
        if (beforeHash && beforeHash !== currentHash) {
          changes.push({
            filePath: file,
            beforeHash,
            afterHash: currentHash,
            changed: true,
          });
        } else if (!beforeHash) {
          // New file
          changes.push({
            filePath: file,
            beforeHash: '',
            afterHash: currentHash,
            changed: true,
          });
        }
      } catch (error) {
        console.warn(`[DocTracker] Failed to check changes for ${file}:`, error instanceof Error ? error.message : error);
      }
    }

    return changes;
  }

  /**
   * Get list of files that should have been updated
   */
  getRequiredDocs(): string[] {
    return [...this.config.trackedFiles];
  }

  /**
   * Enforce documentation updates at handoff
   * Returns result indicating if all required docs were updated
   */
  async enforceAtHandoff(sessionId: string): Promise<{ passed: boolean; missing: string[] }> {
    const previousSnapshot = this.snapshots.get(sessionId);
    if (!previousSnapshot) {
      // No snapshot, all tracked files are considered missing
      return {
        passed: false,
        missing: [...this.config.trackedFiles],
      };
    }

    const changes = await this.checkChanges(sessionId);
    const changedFiles = new Set(changes.filter(c => c.changed).map(c => c.filePath));
    
    // Files that existed in snapshot but weren't changed are "missing"
    const missing: string[] = [];
    for (const file of this.config.trackedFiles) {
      const existedInSnapshot = previousSnapshot.has(file);
      if (existedInSnapshot && !changedFiles.has(file)) {
        missing.push(file);
      }
    }

    return {
      passed: missing.length === 0,
      missing,
    };
  }

  /**
   * Check if critical docs need updating
   */
  async needsUpdate(sessionId: string): Promise<{ needsUpdate: boolean; changed: DocChange[] }> {
    const changes = await this.checkChanges(sessionId);
    const criticalChanges = changes.filter(c => c.changed && c.beforeHash !== ''); // Exclude new files
    
    return {
      needsUpdate: criticalChanges.length > 0,
      changed: changes,
    };
  }

  /**
   * Compute SHA-256 hash of a file
   */
  async computeHash(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve a file path relative to root
   */
  private resolvePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }
    return resolve(this.config.rootPath ?? cwd(), filePath);
  }

  /**
   * Get tracked files list
   */
  getTrackedFiles(): string[] {
    return [...this.config.trackedFiles];
  }

  /**
   * Add a file to tracking
   */
  addTrackedFile(file: string): void {
    if (!this.config.trackedFiles.includes(file)) {
      this.config.trackedFiles.push(file);
    }
  }

  /**
   * Remove a file from tracking
   */
  removeTrackedFile(file: string): void {
    this.config.trackedFiles = this.config.trackedFiles.filter(f => f !== file);
  }

  /**
   * Clear snapshot for a session
   */
  clearSnapshot(sessionId: string): void {
    this.snapshots.delete(sessionId);
  }

  /**
   * Get snapshot hash for a specific file
   */
  getSnapshotHash(sessionId: string, file: string): string | null {
    return this.snapshots.get(sessionId)?.get(file) ?? null;
  }

  /**
   * Check if a snapshot exists for session
   */
  hasSnapshot(sessionId: string): boolean {
    return this.snapshots.has(sessionId);
  }

  /**
   * Get all sessions with snapshots
   */
  getActiveSessions(): string[] {
    return Array.from(this.snapshots.keys());
  }
}

/**
 * Singleton instance
 */
let defaultInstance: DocTracker | null = null;

export function getDocTracker(config?: Partial<DocTrackerConfig>): DocTracker {
  if (!defaultInstance) {
    defaultInstance = new DocTracker(config);
  }
  return defaultInstance;
}
