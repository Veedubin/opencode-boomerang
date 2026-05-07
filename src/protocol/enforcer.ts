/**
 * Protocol Advisor
 * 
 * ENFORCES the protocol - blocks execution if required steps are missing.
 * In strict mode, the orchestrator MUST refuse to proceed until missing steps are completed.
 * 
 * Tracks protocol compliance and returns enforcement results.
 */

import { CheckpointRegistry, type Checkpoint } from './checkpoint.js';
import type { ProtocolContext, ProtocolConfig } from './types.js';
import { createProtocolConfig, isBlocking } from './config.js';
import { ProtocolEventBus, createProtocolEvent } from './events.js';
import { getMemorySystem } from '../memory/index.js';

export interface EnforcementResult {
  canProceed: boolean;
  missingSteps: string[];
  severity: 'info' | 'warning' | 'error';
}

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
   * Check if a session has all required protocol steps completed
   * Returns whether the orchestrator can proceed or must block
   */
  async checkEnforcement(
    sessionId: string,
    checkpoints: Record<string, boolean>
  ): Promise<EnforcementResult> {
    const missingSteps: string[] = [];
    const config = this.config;

    // Memory query is ALWAYS required - no waiver
    if (!checkpoints.memoryQueried) {
      missingSteps.push('MEMORY_QUERY');
    }

    // Sequential thinking check for complex tasks
    if (!checkpoints.sequentialThinkingUsed && config.enforceSequentialThinking) {
      missingSteps.push('SEQUENTIAL_THINK');
    }

    // Planning check (has waiver phrases)
    if (!checkpoints.planApproved && config.enforcePlanning) {
      missingSteps.push('PLAN');
    }

    // Git check (has waiver phrases)
    if (!checkpoints.gitChecked && config.enforceGitCheck) {
      missingSteps.push('GIT_CHECK');
    }

    // Quality gates check (has waiver phrases)
    if (!checkpoints.qualityGatesRun && config.enforceQualityGates) {
      missingSteps.push('QUALITY_GATES');
    }

    // Doc updates check (has waiver phrases)
    if (!checkpoints.docUpdated && config.enforceDocUpdates) {
      missingSteps.push('DOC_UPDATE');
    }

    // Memory save is ALWAYS required - no waiver
    if (!checkpoints.memorySaved) {
      missingSteps.push('MEMORY_SAVE');
    }

    const canProceed = missingSteps.length === 0 || !isBlocking(this.config.strictness);

    return {
      canProceed,
      missingSteps,
      severity: missingSteps.length > 0 ? 'error' : 'info',
    };
  }

  /**
   * Get advisories for a session (for logging/suggestions)
   * OpenCode decides whether to act on them in lenient/standard mode
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
