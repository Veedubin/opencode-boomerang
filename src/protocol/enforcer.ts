/**
 * Protocol Advisor
 * 
 * ADVISORY ONLY - Never blocks execution.
 * OpenCode owns the loop; we just provide suggestions.
 * 
 * Tracks protocol compliance and logs warnings.
 * Auto-fixes when possible, but never blocks.
 */

import { CheckpointRegistry, type Checkpoint } from './checkpoint.js';
import type { ProtocolContext, ProtocolConfig } from './types.js';
import { createProtocolConfig } from './config.js';
import { ProtocolEventBus, createProtocolEvent } from './events.js';
import { getMemorySystem } from '../memory/index.js';

export interface Advisory {
  rule: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  autoFixable: boolean;
  checkpoint?: string;
}

export interface AdvisorResult {
  advisories: Advisory[];
  autoFixed: string[];
}

/**
 * Protocol Advisor - Tracks protocol compliance without blocking
 * 
 * Key difference from old ProtocolEnforcer:
 * - NEVER runs sync shell commands
 * - NEVER blocks execution
 * - Returns advisories for OpenCode to decide on
 */
export class ProtocolAdvisor {
  private registry: CheckpointRegistry;
  private config: ProtocolConfig;
  private eventBus: ProtocolEventBus;
  private sessionData: Map<string, Record<string, boolean>> = new Map();

  constructor() {
    this.config = createProtocolConfig();
    this.registry = CheckpointRegistry.getInstance();
    this.eventBus = new ProtocolEventBus();
  }

  /**
   * Get advisories for a session
   * OpenCode decides whether to act on them
   */
  async advise(
    sessionId: string,
    checkpoints: Record<string, boolean>
  ): Promise<AdvisorResult> {
    const advisories: Advisory[] = [];
    const autoFixed: string[] = [];

    // Memory query check
    if (!checkpoints.memoryQueried) {
      advisories.push({
        rule: 'memory-query',
        severity: 'warning',
        message: 'Memory was not queried before starting work',
        autoFixable: true,
        checkpoint: 'memoryQueryCompleted',
      });

      // Auto-fix: query memory
      await this.autoQueryMemory(sessionId);
      autoFixed.push('memoryQueryCompleted');
    }

    // Sequential thinking check for complex tasks
    if (!checkpoints.sequentialThinkingUsed) {
      advisories.push({
        rule: 'sequential-thinking',
        severity: 'info',
        message: 'Complex task may benefit from sequential thinking',
        autoFixable: false,
        checkpoint: 'sequentialThinkCompleted',
      });
    }

    // Memory save check
    if (!checkpoints.memorySaved) {
      advisories.push({
        rule: 'memory-save',
        severity: 'warning',
        message: 'Results were not saved to memory',
        autoFixable: true,
        checkpoint: 'memorySaveCompleted',
      });
    }

    return { advisories, autoFixed };
  }

  /**
   * Auto-query memory (async, non-blocking)
   */
  private async autoQueryMemory(sessionId: string): Promise<void> {
    try {
      const memorySystem = getMemorySystem();
      if (memorySystem.isInitialized()) {
        await memorySystem.search(`session:${sessionId}`, { topK: 5 });
        this.setSessionCheckpoint(sessionId, 'memoryQueried', true);
      }
    } catch {
      // Memory query failed - just log, don't block
    }
  }

  /**
   * Log protocol checkpoint
   */
  logCheckpoint(sessionId: string, checkpoint: string, passed: boolean): void {
    const eventType = passed ? 'checkpoint.validated' : 'checkpoint.failed';
    this.eventBus.emit(createProtocolEvent(sessionId, eventType, {
      checkpoint,
      passed,
    }));
  }

  /**
   * Get session checkpoint data
   */
  getSessionCheckpoints(sessionId: string): Record<string, boolean> {
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {
        memoryQueried: false,
        sequentialThinkingUsed: false,
        memorySaved: false,
        gitChecked: false,
        qualityGatesRun: false,
        planApproved: false,
      });
    }
    return this.sessionData.get(sessionId)!;
  }

  private setSessionCheckpoint(sessionId: string, name: string, value: boolean): void {
    const checkpoints = this.getSessionCheckpoints(sessionId);
    checkpoints[name] = value;
  }

  /**
   * Get the event bus
   */
  getEventBus(): ProtocolEventBus {
    return this.eventBus;
  }
}

/**
 * Singleton instance
 */
let defaultInstance: ProtocolAdvisor | null = null;

export function getProtocolAdvisor(): ProtocolAdvisor {
  if (!defaultInstance) {
    defaultInstance = new ProtocolAdvisor();
  }
  return defaultInstance;
}

export function resetProtocolAdvisor(): void {
  if (defaultInstance) {
    defaultInstance.getEventBus().clear();
    defaultInstance = null;
  }
}
