import { protocolTracker } from './tracker.js';
import { getMemoryService } from '../memory-service.js';

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

export class ProtocolEnforcer {
  private config: EnforcementConfig;

  constructor(config: Partial<EnforcementConfig> = {}) {
    this.config = { ...DEFAULT_ENFORCEMENT_CONFIG, ...config };
  }

  async validatePreConditions(sessionId: string, taskDescription: string): Promise<EnforcementResult> {
    const checkpoints = protocolTracker.getCheckpoints(sessionId);
    const violations: Violation[] = [];
    const autoFixed: Violation[] = [];

    if (this.config.enforceMemoryQuery && !checkpoints.memoryQueried) {
      const violation: Violation = {
        rule: 'memory-query', severity: 'error',
        message: 'Memory was not queried before starting work', autoFixable: true,
      };
      violations.push(violation);
      if (this.config.autoFix) {
        try {
          const memoryService = getMemoryService();
          if (memoryService.isInitialized()) {
            await memoryService.queryMemories(taskDescription, { limit: 5 });
            protocolTracker.recordToolCall(sessionId, 'query_memories', { query: taskDescription });
            autoFixed.push(violation);
          }
        } catch { /* auto-fix failed */ }
      }
    }

    if (this.config.enforceSequentialThinking && !checkpoints.sequentialThinkingUsed) {
      const isComplex = taskDescription.length > 100 || /architect|design|refactor|implement|multiple|complex|integration/.test(taskDescription.toLowerCase());
      if (isComplex) {
        violations.push({
          rule: 'sequential-thinking', severity: 'warning',
          message: 'Complex task should use sequential-thinking', autoFixable: false,
        });
      }
    }

    return { passed: violations.length === autoFixed.length, violations, autoFixed };
  }

  async validatePostConditions(sessionId: string): Promise<EnforcementResult> {
    const checkpoints = protocolTracker.getCheckpoints(sessionId);
    const violations: Violation[] = [];
    const autoFixed: Violation[] = [];

    if (this.config.enforceMemorySave && !checkpoints.memorySaved) {
      const violation: Violation = {
        rule: 'memory-save', severity: 'error',
        message: 'Results were not saved to memory', autoFixable: true,
      };
      violations.push(violation);
      if (this.config.autoFix) {
        try {
          const memoryService = getMemoryService();
          if (memoryService.isInitialized()) {
            await memoryService.addMemory({ content: `Task completed`, sourceType: 'conversation', sessionId });
            protocolTracker.recordToolCall(sessionId, 'add_memory', { sessionId });
            autoFixed.push(violation);
          }
        } catch { /* auto-fix failed */ }
      }
    }

    if (this.config.enforceQualityGates && checkpoints.codeChangesMade && !checkpoints.qualityGatesRun) {
      violations.push({
        rule: 'quality-gates', severity: 'error',
        message: 'Code changes made but quality gates not run', autoFixable: false,
      });
    }

    return { passed: violations.length === autoFixed.length, violations, autoFixed };
  }

  async enforceGitCheck(sessionId: string): Promise<{ clean: boolean; branch?: string; error?: string }> {
    if (!this.config.enforceGitCheck) return { clean: true };
    try {
      const { execSync } = await import('child_process');
      const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: process.cwd() });
      const branch = execSync('git branch --show-current', { encoding: 'utf-8', cwd: process.cwd() }).trim();
      const clean = status.trim().length === 0;
      protocolTracker.getOrCreateSession(sessionId).checkpoints.gitChecked = true;
      return { clean, branch };
    } catch (error) {
      return { clean: false, error: error instanceof Error ? error.message : 'Git check failed' };
    }
  }

  async enforceQualityGates(sessionId: string): Promise<{ passed: boolean; errors: string[] }> {
    if (!this.config.enforceQualityGates) return { passed: true, errors: [] };
    const errors: string[] = [];
    try {
      const { execSync } = await import('child_process');
      try { execSync('npm run typecheck', { encoding: 'utf-8', cwd: process.cwd() }); } catch { errors.push('Type check failed'); }
      try { execSync('npm test -- --run', { encoding: 'utf-8', cwd: process.cwd() }); } catch { errors.push('Tests failed'); }
      protocolTracker.markQualityGatesRun(sessionId);
      return { passed: errors.length === 0, errors };
    } catch (error) {
      return { passed: false, errors: [error instanceof Error ? error.message : 'Quality gates failed'] };
    }
  }
}