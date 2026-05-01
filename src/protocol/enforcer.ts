/**
 * Protocol Enforcer
 * 
 * Validates all checkpoints for protocol execution using CheckpointRegistry.
 * Implements actual blocking enforcement with auto-fix and waiver support.
 * Part of Protocol Enforcement v4.0.
 * 
 * Maintains backward compatibility with the old API:
 * - validatePreConditions / validatePostConditions
 * - enforceGitCheck / enforceQualityGates
 * - DEFAULT_ENFORCEMENT_CONFIG
 */

import { CheckpointRegistry, Checkpoint } from './checkpoint.js';
import { ProtocolContext, CheckpointResult, ProtocolConfig } from './types.js';
import { createProtocolConfig, isBlocking, isWarning } from './config.js';
import { ProtocolEventBus, createProtocolEvent } from './events.js';
import { getMemoryService } from '../memory-service.js';
import { getSequentialThinker, SequentialThinker } from '../execution/sequential-thinker.js';
import { getDocTracker, DocTracker } from '../execution/doc-tracker.js';
import { execSync } from 'node:child_process';
import { cwd } from 'node:process';

export interface EnforcementResult {
  passed: boolean;
  violations: Violation[];
  autoFixed: Violation[];
}

export interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  autoFixable: boolean;
}

export interface EnforcementConfig {
  enforceMemoryQuery: boolean;
  enforceSequentialThinking: boolean;
  enforceMemorySave: boolean;
  enforceGitCheck: boolean;
  enforceQualityGates: boolean;
  autoFix: boolean;
}

export const DEFAULT_ENFORCEMENT_CONFIG: EnforcementConfig = {
  enforceMemoryQuery: true,
  enforceSequentialThinking: true,
  enforceMemorySave: true,
  enforceGitCheck: true,
  enforceQualityGates: true,
  autoFix: true,
};

export interface GitCheckResult {
  clean: boolean;
  branch?: string;
  error?: string;
}

export interface QualityGatesResult {
  passed: boolean;
  errors: string[];
}

/**
 * Protocol enforcement with checkpoint validation
 */
export class ProtocolEnforcer {
  private registry: CheckpointRegistry;
  private config: ProtocolConfig;
  private configEnforcement: EnforcementConfig;
  private eventBus: ProtocolEventBus;
  private sequentialThinker: SequentialThinker;
  private docTracker: DocTracker;
  private initialized = false;
  private sessionData: Map<string, Record<string, boolean>> = new Map();

  constructor(configEnforcement: Partial<EnforcementConfig> = {}) {
    this.configEnforcement = { ...DEFAULT_ENFORCEMENT_CONFIG, ...configEnforcement };
    this.config = createProtocolConfig();
    this.registry = CheckpointRegistry.getInstance();
    this.eventBus = new ProtocolEventBus();
    this.sequentialThinker = getSequentialThinker();
    this.docTracker = getDocTracker();
  }

  /**
   * Initialize and register all built-in checkpoints
   */
  private initialize(): void {
    if (this.initialized) return;
    
    this.registerBuiltInCheckpoints();
    this.initialized = true;
  }

  // ========== BACKWARD COMPATIBILITY API ==========

  /**
   * Validate pre-conditions (old API)
   */
  async validatePreConditions(sessionId: string, taskDescription: string): Promise<EnforcementResult> {
    this.initialize();
    
    const checkpoints = this.getSessionCheckpoints(sessionId);
    const violations: Violation[] = [];
    const autoFixed: Violation[] = [];

    if (this.configEnforcement.enforceMemoryQuery && !checkpoints.memoryQueried) {
      const violation: Violation = {
        rule: 'memory-query',
        severity: 'error',
        message: 'Memory was not queried before starting work',
        autoFixable: true,
      };
      violations.push(violation);

      const memoryService = getMemoryService();
      if (memoryService.isFallbackMode()) {
        violations.push({
          rule: 'memory-query',
          severity: 'warning',
          message: 'Memory unavailable (fallback mode)',
          autoFixable: false,
        });
      } else if (this.configEnforcement.autoFix) {
        try {
          if (memoryService.isInitialized()) {
            await memoryService.queryMemories(taskDescription, { limit: 5 });
            this.setSessionCheckpoint(sessionId, 'memoryQueried', true);
            autoFixed.push(violation);
          }
        } catch {
          // auto-fix failed
        }
      }
    }

    if (this.configEnforcement.enforceSequentialThinking && !checkpoints.sequentialThinkingUsed) {
      const isComplex = taskDescription.length > 100 || 
        /architect|design|refactor|implement|multiple|complex|integration/i.test(taskDescription);
      if (isComplex) {
        violations.push({
          rule: 'sequential-thinking',
          severity: 'warning',
          message: 'Complex task should use sequential-thinking',
          autoFixable: false,
        });
      }
    }

    return {
      passed: violations.length === autoFixed.length,
      violations,
      autoFixed,
    };
  }

  /**
   * Validate post-conditions (old API)
   */
  async validatePostConditions(sessionId: string): Promise<EnforcementResult> {
    this.initialize();
    
    const checkpoints = this.getSessionCheckpoints(sessionId);
    const violations: Violation[] = [];
    const autoFixed: Violation[] = [];

    if (this.configEnforcement.enforceMemorySave && !checkpoints.memorySaved) {
      const violation: Violation = {
        rule: 'memory-save',
        severity: 'error',
        message: 'Results were not saved to memory',
        autoFixable: true,
      };
      violations.push(violation);

      const memoryService = getMemoryService();
      if (memoryService.isFallbackMode()) {
        violations.push({
          rule: 'memory-save',
          severity: 'warning',
          message: 'Memory unavailable (fallback mode)',
          autoFixable: false,
        });
      } else if (this.configEnforcement.autoFix) {
        try {
          if (memoryService.isInitialized()) {
            await memoryService.addMemory({
              content: 'Task completed',
              sourceType: 'conversation',
              sessionId,
            });
            this.setSessionCheckpoint(sessionId, 'memorySaved', true);
            autoFixed.push(violation);
          }
        } catch {
          // auto-fix failed
        }
      }
    }

    if (this.configEnforcement.enforceQualityGates && checkpoints.codeChangesMade && !checkpoints.qualityGatesRun) {
      violations.push({
        rule: 'quality-gates',
        severity: 'error',
        message: 'Code changes made but quality gates not run',
        autoFixable: false,
      });
    }

    return {
      passed: violations.length === autoFixed.length,
      violations,
      autoFixed,
    };
  }

  /**
   * Enforce git check (old API)
   */
  async enforceGitCheck(sessionId: string): Promise<GitCheckResult> {
    if (!this.configEnforcement.enforceGitCheck) {
      return { clean: true };
    }

    try {
      const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: cwd() });
      const branch = execSync('git branch --show-current', { encoding: 'utf-8', cwd: cwd() }).trim();
      const clean = status.trim().length === 0;
      this.setSessionCheckpoint(sessionId, 'gitChecked', true);
      return { clean, branch };
    } catch (error) {
      return {
        clean: false,
        error: error instanceof Error ? error.message : 'Git check failed',
      };
    }
  }

  /**
   * Enforce quality gates (old API)
   */
  async enforceQualityGates(sessionId: string): Promise<QualityGatesResult> {
    if (!this.configEnforcement.enforceQualityGates) {
      return { passed: true, errors: [] };
    }

    const errors: string[] = [];

    try {
      // Typecheck
      try {
        execSync('bun run typecheck', { encoding: 'utf-8', cwd: cwd(), stdio: 'pipe' });
      } catch {
        errors.push('Type check failed');
      }

      // Tests
      try {
        execSync('bun test -- --run', { encoding: 'utf-8', cwd: cwd(), stdio: 'pipe' });
      } catch {
        errors.push('Tests failed');
      }

      this.setSessionCheckpoint(sessionId, 'qualityGatesRun', true);
      return { passed: errors.length === 0, errors };
    } catch (error) {
      return {
        passed: false,
        errors: [error instanceof Error ? error.message : 'Quality gates failed'],
      };
    }
  }

  // ========== NEW CHECKPOINT-BASED API ==========

  /**
   * Validate all checkpoints for a given state (new API)
   */
  async validateForState(
    state: string,
    sessionId: string,
    ctx: ProtocolContext
  ): Promise<{ passed: boolean; failures: string[]; autoFixed: string[]; waived: string[] }> {
    this.initialize();

    const failures: string[] = [];
    const autoFixed: string[] = [];
    const waived: string[] = [];

    // Map state to required checkpoint names
    const checkpointsForState = this.getCheckpointsForState(state);

    for (const checkpointName of checkpointsForState) {
      // Check for waiver first
      const waiverPhrase = this.checkForWaiver(ctx.taskDescription, checkpointName);
      if (waiverPhrase) {
        waived.push(`${checkpointName}: "${waiverPhrase}"`);
        this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.waived', {
          checkpoint: checkpointName,
          waiverPhrase,
        }));
        continue;
      }

      // Validate checkpoint
      const result = await this.registry.validate(checkpointName, sessionId, ctx);

      if (!result.passed) {
        // Check if we can auto-fix
        const checkpoint = this.registry.get(checkpointName);
        if (checkpoint?.autoFixable && checkpoint.autoFix) {
          const autoFixResult = await checkpoint.autoFix(sessionId, ctx);
          if (autoFixResult.passed) {
            autoFixed.push(checkpointName);
            this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.validated', {
              checkpoint: checkpointName,
              result: autoFixResult,
              autoFixed: true,
            }));
            continue;
          }
        }

        failures.push(result.message || `Checkpoint ${checkpointName} failed`);
        this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.failed', {
          checkpoint: checkpointName,
          message: result.message,
        }));
      }
    }

    const passed = failures.length === 0;

    return { passed, failures, autoFixed, waived };
  }

  /**
   * Auto-fix a failed checkpoint if possible
   */
  async autoFix(
    checkpointName: string,
    sessionId: string,
    ctx: ProtocolContext
  ): Promise<CheckpointResult> {
    const checkpoint = this.registry.get(checkpointName);
    if (!checkpoint) {
      return { passed: false, message: `Checkpoint ${checkpointName} not found` };
    }

    if (!checkpoint.autoFixable || !checkpoint.autoFix) {
      return { passed: false, message: `Checkpoint ${checkpointName} is not auto-fixable` };
    }

    try {
      const result = await checkpoint.autoFix(sessionId, ctx);
      return { ...result, autoFixed: true };
    } catch (error) {
      return {
        passed: false,
        message: `Auto-fix failed for ${checkpointName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ========== INTERNAL HELPERS ==========

  /**
   * Get checkpoint names required for a state
   */
  private getCheckpointsForState(state: string): string[] {
    const stateCheckpoints: Record<string, string[]> = {
      MEMORY_QUERY: ['memoryQueryCompleted'],
      SEQUENTIAL_THINK: ['sequentialThinkCompleted'],
      PLAN: ['planApproved'],
      DELEGATE: ['delegationCompleted'],
      GIT_CHECK: ['gitCheckPassed'],
      QUALITY_GATES: ['qualityGatesPassed'],
      DOC_UPDATE: ['docsUpdated'],
      MEMORY_SAVE: ['memorySaveCompleted'],
    };

    return stateCheckpoints[state] || [];
  }

  /**
   * Check if task description contains waiver phrase for checkpoint
   */
  private checkForWaiver(taskDescription: string, checkpointName: string): string | null {
    const lowerDesc = taskDescription.toLowerCase();
    const waiverPhrases = this.config.waiverPhrases;

    const checkpointWaivers: Record<string, string[]> = {
      memoryQueryCompleted: [],
      sequentialThinkCompleted: waiverPhrases.sequentialThinking || [],
      planApproved: waiverPhrases.planning || [],
      gitCheckPassed: waiverPhrases.gitCheck || [],
      qualityGatesPassed: waiverPhrases.qualityGates || [],
      docsUpdated: waiverPhrases.docUpdates || [],
      memorySaveCompleted: [],
    };

    const waivers = checkpointWaivers[checkpointName] || [];
    for (const phrase of waivers) {
      if (lowerDesc.includes(phrase.toLowerCase())) {
        return phrase;
      }
    }

    return null;
  }

  /**
   * Register all built-in checkpoints
   */
  private registerBuiltInCheckpoints(): void {
    this.registry.register(this.createMemoryQueryCheckpoint());
    this.registry.register(this.createSequentialThinkCheckpoint());
    this.registry.register(this.createPlanApprovalCheckpoint());
    this.registry.register(this.createDelegationCheckpoint());
    this.registry.register(this.createGitCheckCheckpoint());
    this.registry.register(this.createQualityGatesCheckpoint());
    this.registry.register(this.createDocsUpdatedCheckpoint());
    this.registry.register(this.createMemorySaveCheckpoint());
  }

  /**
   * Create memory query completed checkpoint
   */
  private createMemoryQueryCheckpoint(): Checkpoint {
    return {
      name: 'memoryQueryCompleted',
      description: 'Validates memory was queried before starting work',
      autoFixable: true,
      waiverPhrases: [],
      validate: async (sessionId, ctx) => {
        const memoryService = getMemoryService();
        
        if (memoryService.isFallbackMode()) {
          return { passed: true, message: 'Memory unavailable (fallback mode)' };
        }

        const checkpoints = this.getSessionCheckpoints(sessionId);
        
        if (checkpoints.memoryQueried) {
          return { passed: true };
        }

        return { passed: false, message: 'Memory was not queried before starting work' };
      },
      autoFix: async (sessionId, ctx) => {
        const memoryService = getMemoryService();
        
        if (memoryService.isFallbackMode()) {
          return { passed: true, message: 'Memory unavailable (fallback mode)' };
        }

        try {
          await memoryService.queryMemories(ctx.taskDescription, { limit: 5 });
          this.setSessionCheckpoint(sessionId, 'memoryQueried', true);
          return { passed: true, message: 'Memory auto-queried' };
        } catch (error) {
          return {
            passed: false,
            message: `Auto-query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    };
  }

  /**
   * Create sequential thinking completed checkpoint
   */
  private createSequentialThinkCheckpoint(): Checkpoint {
    return {
      name: 'sequentialThinkCompleted',
      description: 'Validates sequential thinking was performed for complex tasks',
      autoFixable: true,
      waiverPhrases: ['no thinking needed', 'skip thinking'],
      validate: async (sessionId, ctx) => {
        const checkpoints = this.getSessionCheckpoints(sessionId);
        
        if (!this.sequentialThinker.shouldThink(ctx.taskDescription)) {
          return { passed: true, message: 'Task does not require sequential thinking' };
        }

        if (checkpoints.sequentialThinkingUsed) {
          return { passed: true };
        }

        return { passed: false, message: 'Complex task should use sequential thinking' };
      },
      autoFix: async (sessionId, ctx) => {
        try {
          const result = await this.sequentialThinker.analyze(ctx.taskDescription);
          if (result.completed) {
            this.setSessionCheckpoint(sessionId, 'sequentialThinkingUsed', true);
            return { passed: true, message: 'Sequential thinking auto-performed' };
          }
          return { passed: false, message: 'Sequential thinking did not complete' };
        } catch (error) {
          return {
            passed: false,
            message: `Auto-thinking failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    };
  }

  /**
   * Create plan approval checkpoint
   */
  private createPlanApprovalCheckpoint(): Checkpoint {
    return {
      name: 'planApproved',
      description: 'Validates plan was created and approved',
      autoFixable: false,
      waiverPhrases: ['skip planning', 'just do it', 'no plan needed'],
      validate: async (sessionId, ctx) => {
        const checkpoints = this.getSessionCheckpoints(sessionId);

        const taskDesc = ctx.taskDescription.toLowerCase();
        const isBuildTask = /implement|create|build|design|architecture/i.test(taskDesc);
        
        if (!isBuildTask && ctx.taskType !== 'code_generation' && ctx.taskType !== 'refactoring') {
          return { passed: true, message: 'Planning not required for this task type' };
        }

        if (checkpoints.planApproved) {
          return { passed: true };
        }

        return { passed: false, message: 'Plan was not created and approved' };
      },
    };
  }

  /**
   * Create delegation completed checkpoint
   */
  private createDelegationCheckpoint(): Checkpoint {
    return {
      name: 'delegationCompleted',
      description: 'Validates task was delegated',
      autoFixable: false,
      waiverPhrases: [],
      validate: async (sessionId, ctx) => {
        const checkpoints = this.getSessionCheckpoints(sessionId);

        if (checkpoints.delegated) {
          return { passed: true };
        }

        return { passed: false, message: 'Task was not delegated' };
      },
    };
  }

  /**
   * Create git check passed checkpoint
   */
  private createGitCheckCheckpoint(): Checkpoint {
    return {
      name: 'gitCheckPassed',
      description: 'Validates git check passed',
      autoFixable: false,
      waiverPhrases: ['--force', 'git is fine', 'proceed anyway'],
      validate: async (sessionId, ctx) => {
        try {
          const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: cwd() });
          const clean = status.trim().length === 0;
          
          if (clean) {
            this.setSessionCheckpoint(sessionId, 'gitChecked', true);
            return { passed: true };
          }

          const branch = execSync('git branch --show-current', { encoding: 'utf-8', cwd: cwd() }).trim();
          return {
            passed: false,
            message: `Git working tree is dirty (branch: ${branch}). Commit or stash changes before proceeding.`,
          };
        } catch (error) {
          if (isBlocking(this.config.strictness)) {
            return { passed: false, message: 'Git is not available' };
          }
          return { passed: true, message: 'Git check skipped (git unavailable)' };
        }
      },
    };
  }

  /**
   * Create quality gates passed checkpoint
   */
  private createQualityGatesCheckpoint(): Checkpoint {
    return {
      name: 'qualityGatesPassed',
      description: 'Validates lint/typecheck/test passed',
      autoFixable: false,
      waiverPhrases: ['skip tests', 'skip gates'],
      validate: async (sessionId, ctx) => {
        try {
          const errors: string[] = [];

          // Run typecheck
          try {
            execSync('bun run typecheck', { encoding: 'utf-8', cwd: cwd(), stdio: 'pipe' });
          } catch (error) {
            errors.push(`Type check failed: ${error instanceof Error ? error.message : 'Unknown'}`);
          }

          // Run tests
          try {
            execSync('bun test', { encoding: 'utf-8', cwd: cwd(), stdio: 'pipe' });
          } catch (error) {
            errors.push(`Tests failed: ${error instanceof Error ? error.message : 'Unknown'}`);
          }

          if (errors.length > 0) {
            this.setSessionCheckpoint(sessionId, 'qualityGatesRun', true);
            return { passed: false, message: errors.join('; ') };
          }

          this.setSessionCheckpoint(sessionId, 'qualityGatesRun', true);
          return { passed: true };
        } catch (error) {
          return {
            passed: false,
            message: `Quality gates error: ${error instanceof Error ? error.message : 'Unknown'}`,
          };
        }
      },
    };
  }

  /**
   * Create docs updated checkpoint
   */
  private createDocsUpdatedCheckpoint(): Checkpoint {
    return {
      name: 'docsUpdated',
      description: 'Validates documentation was updated',
      autoFixable: false,
      waiverPhrases: ['no docs needed'],
      validate: async (sessionId, ctx) => {
        if (!this.docTracker.hasSnapshot(sessionId)) {
          await this.docTracker.snapshot(sessionId);
        }

        const result = await this.docTracker.enforceAtHandoff(sessionId);
        
        if (result.passed) {
          return { passed: true };
        }

        return {
          passed: false,
          message: `Documentation not updated: ${result.missing.join(', ')}`,
        };
      },
    };
  }

  /**
   * Create memory save completed checkpoint
   */
  private createMemorySaveCheckpoint(): Checkpoint {
    return {
      name: 'memorySaveCompleted',
      description: 'Validates memory was saved',
      autoFixable: true,
      waiverPhrases: [],
      validate: async (sessionId, ctx) => {
        const checkpoints = this.getSessionCheckpoints(sessionId);

        if (checkpoints.memorySaved) {
          return { passed: true };
        }

        return { passed: false, message: 'Memory was not saved' };
      },
      autoFix: async (sessionId, ctx) => {
        const memoryService = getMemoryService();
        
        if (memoryService.isFallbackMode()) {
          return { passed: true, message: 'Memory unavailable (fallback mode)' };
        }

        try {
          const summary = `Session ${sessionId} completed: ${ctx.taskDescription.substring(0, 200)}`;
          await memoryService.addMemory({
            content: summary,
            sourceType: 'conversation',
            sessionId,
            metadata: {
              taskType: ctx.taskType,
              agent: ctx.agent,
              timestamp: Date.now(),
            },
          });
          this.setSessionCheckpoint(sessionId, 'memorySaved', true);
          return { passed: true, message: 'Memory auto-saved' };
        } catch (error) {
          return {
            passed: false,
            message: `Auto-save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    };
  }

  /**
   * Get session checkpoints
   */
  private getSessionCheckpoints(sessionId: string): Record<string, boolean> {
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {
        memoryQueried: false,
        sequentialThinkingUsed: false,
        memorySaved: false,
        gitChecked: false,
        qualityGatesRun: false,
        codeChangesMade: false,
        planApproved: false,
        delegated: false,
      });
    }
    return this.sessionData.get(sessionId)!;
  }

  private setSessionCheckpoint(sessionId: string, name: string, value: boolean): void {
    const checkpoints = this.getSessionCheckpoints(sessionId);
    checkpoints[name] = value;
  }

  /**
   * Get the checkpoint registry
   */
  getRegistry(): CheckpointRegistry {
    return this.registry;
  }

  /**
   * Get the event bus
   */
  getEventBus(): ProtocolEventBus {
    return this.eventBus;
  }

  /**
   * Get the doc tracker
   */
  getDocTracker(): DocTracker {
    return this.docTracker;
  }
}

/**
 * Singleton instance
 */
let defaultInstance: ProtocolEnforcer | null = null;

export function getProtocolEnforcer(config?: Partial<EnforcementConfig>): ProtocolEnforcer {
  if (!defaultInstance) {
    defaultInstance = new ProtocolEnforcer(config);
  }
  return defaultInstance;
}

export function resetProtocolEnforcer(): void {
  if (defaultInstance) {
    defaultInstance.getEventBus().clear();
    defaultInstance = null;
  }
}
