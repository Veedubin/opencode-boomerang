/**
 * DocTracker Tests
 * 
 * Tests for documentation tracking with SHA-256 hash comparison.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocTracker } from '../../../src/execution/doc-tracker.js';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('DocTracker', () => {
  const testDir = resolve(tmpdir(), 'doc-tracker-test-' + Date.now());
  let tracker: DocTracker;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    tracker = new DocTracker({
      trackedFiles: ['AGENTS.md', 'README.md', 'CHANGELOG.md'],
      rootPath: testDir,
    });
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await unlink(resolve(testDir, 'AGENTS.md'));
      await unlink(resolve(testDir, 'README.md'));
      await unlink(resolve(testDir, 'CHANGELOG.md'));
      await unlink(resolve(testDir, 'NEW.md'));
    } catch {
      // Files may not exist
    }
  });

  describe('computeHash', () => {
    it('should compute consistent SHA-256 hash for same content', async () => {
      const content = 'Test content for hashing';
      const filePath = resolve(testDir, 'test.txt');
      await writeFile(filePath, content);

      const hash1 = await tracker.computeHash(filePath);
      const hash2 = await tracker.computeHash(filePath);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should compute different hash for different content', async () => {
      const filePath = resolve(testDir, 'test.txt');
      await writeFile(filePath, 'Content A');
      const hashA = await tracker.computeHash(filePath);

      await writeFile(filePath, 'Content B');
      const hashB = await tracker.computeHash(filePath);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('snapshot and checkChanges', () => {
    it('should detect file changes after snapshot', async () => {
      const agentsPath = resolve(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Agents\nInitial content');

      // Take snapshot
      await tracker.snapshot('session-1');

      // Modify file
      await writeFile(agentsPath, '# Agents\nUpdated content');

      // Check changes
      const changes = await tracker.checkChanges('session-1');
      const agentsChange = changes.find(c => c.filePath === 'AGENTS.md');

      expect(agentsChange).toBeDefined();
      expect(agentsChange!.changed).toBe(true);
      expect(agentsChange!.beforeHash).not.toBe(agentsChange!.afterHash);
    });

    it('should return empty changes if no snapshot exists', async () => {
      const changes = await tracker.checkChanges('nonexistent-session');
      expect(changes).toEqual([]);
    });

    it('should not add to changes array if file not modified', async () => {
      const agentsPath = resolve(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Agents\nContent');
      await writeFile(resolve(testDir, 'README.md'), '# Readme\nContent');

      await tracker.snapshot('session-3');

      // Don't modify any files

      const changes = await tracker.checkChanges('session-3');
      
      // No files were changed, so changes array should be empty
      expect(changes.length).toBe(0);
    });
  });

  describe('enforceAtHandoff', () => {
    it('should pass when all tracked files were updated', async () => {
      const agentsPath = resolve(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Agents\nContent');
      await writeFile(resolve(testDir, 'README.md'), '# Readme\nContent');

      await tracker.snapshot('session-4');

      // Modify both files
      await writeFile(agentsPath, '# Agents\nUpdated');
      await writeFile(resolve(testDir, 'README.md'), '# Readme\nUpdated');

      const result = await tracker.enforceAtHandoff('session-4');

      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should fail when tracked files were not updated', async () => {
      const agentsPath = resolve(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Agents\nContent');
      await writeFile(resolve(testDir, 'README.md'), '# Readme\nContent');

      await tracker.snapshot('session-5');

      // Only modify one file
      await writeFile(agentsPath, '# Agents\nUpdated');

      const result = await tracker.enforceAtHandoff('session-5');

      expect(result.passed).toBe(false);
      expect(result.missing).toContain('README.md');
    });
  });

  describe('needsUpdate', () => {
    it('should detect when critical docs need updating', async () => {
      const agentsPath = resolve(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Agents\nContent');

      await tracker.snapshot('session-6');

      // Modify file
      await writeFile(agentsPath, '# Agents\nUpdated');

      const result = await tracker.needsUpdate('session-6');

      expect(result.needsUpdate).toBe(true);
      expect(result.changed.length).toBeGreaterThan(0);
    });

    it('should not require update for new files only', async () => {
      await tracker.snapshot('session-7');

      // Create new file (not tracked)
      const newPath = resolve(testDir, 'NEW.md');
      await writeFile(newPath, '# New');

      const result = await tracker.needsUpdate('session-7');

      // New files don't count as "needs update"
      expect(result.needsUpdate).toBe(false);
    });
  });

  describe('tracked files management', () => {
    it('should return configured tracked files', () => {
      const files = tracker.getTrackedFiles();
      expect(files).toContain('AGENTS.md');
      expect(files).toContain('README.md');
      expect(files).toContain('CHANGELOG.md');
    });

    it('should allow adding tracked files', () => {
      tracker.addTrackedFile('NEW.md');
      const files = tracker.getTrackedFiles();
      expect(files).toContain('NEW.md');
    });

    it('should allow removing tracked files', () => {
      tracker.removeTrackedFile('CHANGELOG.md');
      const files = tracker.getTrackedFiles();
      expect(files).not.toContain('CHANGELOG.md');
    });
  });

  describe('snapshot management', () => {
    it('should check if snapshot exists', () => {
      expect(tracker.hasSnapshot('nonexistent')).toBe(false);
    });

    it('should clear snapshot for session', () => {
      tracker.clearSnapshot('session-x');
      expect(tracker.hasSnapshot('session-x')).toBe(false);
    });

    it('should get snapshot hash for specific file', async () => {
      const agentsPath = resolve(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Agents\nContent');

      await tracker.snapshot('session-8');

      const hash = tracker.getSnapshotHash('session-8', 'AGENTS.md');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return null for non-existent snapshot hash', () => {
      const hash = tracker.getSnapshotHash('nonexistent', 'AGENTS.md');
      expect(hash).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    it('should return list of sessions with snapshots', async () => {
      await tracker.snapshot('session-a');
      await tracker.snapshot('session-b');

      const sessions = tracker.getActiveSessions();
      expect(sessions).toContain('session-a');
      expect(sessions).toContain('session-b');
    });
  });
});
