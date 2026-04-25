# Boomerang-v2 Architectural Recovery Plan

> **Status**: CRITICAL — Architecture Restoration Required
> **Version**: 1.0.0
> **Date**: 2026-04-25
> **Scope**: Fix broken MCP-only architecture, implement protocol enforcement, add missing automation

---

## Executive Summary

Boomerang-v2 was incorrectly converted to **MCP-only** for memory operations, when the intended architecture was **built-in direct integration** with Super-Memory-TS core modules. The built-in code in `src/memory/` and `src/project-index/` exists but is unused, while `src/memory-client.ts` wastefully spawns the same codebase as an MCP subprocess.

Additionally, the Boomerang Protocol has critical enforcement and automation gaps that make it honor-system rather than guaranteed.

This plan details how to restore the correct architecture and implement missing enforcement/automation.

---

## Part 1: Restore Built-in Integration

### Problem

Current (broken) flow:
```
Orchestrator → MemoryClient (MCP) → spawns subprocess → src/server.ts (MCP) → src/memory/ (built-in)
```

This serializes through JSON-RPC for zero benefit. The built-in memory code is already in the same process.

Desired (fixed) flow:
```
Orchestrator → MemoryService (direct import) → src/memory/ (built-in)
                                    ↓
                            src/project-index/ (built-in)
```

### Solution: MemoryService

Create a unified service that wraps the built-in memory and project-index modules with a clean, promise-based API.

#### File: `src/memory-service.ts` (NEW)

```typescript
import { getMemorySystem, MemorySystem } from './memory/index.js';
import { searchProject, type SearchResult as ProjectSearchResult } from './project-index/search.js';
import { ProjectIndexer } from './project-index/indexer.js';

export interface MemoryQueryOptions {
  limit?: number;
  strategy?: 'tiered' | 'vector_only' | 'text_only';
  threshold?: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface ProjectChunk {
  filePath: string;
  content: string;
  lineStart?: number;
  lineEnd?: number;
  score?: number;
}

/**
 * MemoryService — Direct built-in integration for Boomerang
 * 
 * Replaces MemoryClient (MCP) for internal use.
 * Uses src/memory/ and src/project-index/ directly with zero serialization overhead.
 */
export class MemoryService {
  private memorySystem: MemorySystem;
  private initialized = false;
  private activeIndexer: ProjectIndexer | null = null;

  constructor() {
    this.memorySystem = getMemorySystem();
  }

  /**
   * Initialize the memory system
   */
  async initialize(dbUri?: string): Promise<void> {
    if (this.initialized) return;
    await this.memorySystem.initialize(dbUri);
    this.initialized = true;
  }

  /**
   * Query memories using semantic search
   */
  async queryMemories(query: string, options: MemoryQueryOptions = {}): Promise<MemoryEntry[]> {
    this.ensureInitialized();
    const results = await this.memorySystem.search(query, {
      topK: options.limit ?? 10,
      strategy: options.strategy ?? 'TIERED',
      threshold: options.threshold ?? 0.7,
    });
    return results.map(r => ({
      id: r.entry.id,
      content: r.entry.text,
      score: r.score,
      metadata: r.entry.metadataJson ? JSON.parse(r.entry.metadataJson) : {},
    }));
  }

  /**
   * Add a memory entry
   */
  async addMemory(entry: {
    content: string;
    sourceType?: 'file' | 'conversation' | 'manual' | 'web';
    sourcePath?: string;
    metadata?: Record<string, unknown>;
    sessionId?: string;
  }): Promise<{ id: string }> {
    this.ensureInitialized();
    const result = await this.memorySystem.addMemory({
      text: entry.content,
      sourceType: entry.sourceType ?? 'manual',
      sourcePath: entry.sourcePath ?? '',
      sessionId: entry.sessionId ?? 'default',
      metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : '{}',
    });
    return { id: result.id };
  }

  /**
   * Search indexed project files
   */
  async searchProject(query: string, topK: number = 10): Promise<ProjectChunk[]> {
    const results = await searchProject(query, topK);
    return results.map(r => ({
      filePath: r.filePath,
      content: r.content,
      lineStart: r.lineStart,
      lineEnd: r.lineEnd,
      score: r.score,
    }));
  }

  /**
   * Index a project directory
   */
  async indexProject(rootPath: string, dbUri?: string): Promise<void> {
    const indexer = new ProjectIndexer(dbUri ?? 'memory://', rootPath);
    await indexer.start();
    this.activeIndexer = indexer;
  }

  /**
   * Check if memory system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MemoryService not initialized. Call initialize() first.');
    }
  }
}

/** Singleton instance */
let serviceInstance: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!serviceInstance) {
    serviceInstance = new MemoryService();
  }
  return serviceInstance;
}
```

### Changes to Existing Files

#### `src/index.ts` (MODIFY)

Replace `MemoryClient` with `MemoryService`:

```typescript
// BEFORE (broken — MCP client)
import { MemoryClient } from './memory-client.js';
let memoryClient: MemoryClient | null = null;

// AFTER (fixed — direct integration)
import { MemoryService, getMemoryService } from './memory-service.js';
let memoryService: MemoryService | null = null;

// In execute():
// BEFORE
memoryClient = new MemoryClient();
await memoryClient.connect();

// AFTER
memoryService = getMemoryService();
await memoryService.initialize();
```

All internal calls should use `memoryService.queryMemories()`, `memoryService.addMemory()`, etc. directly.

#### `src/orchestrator.ts` (MODIFY)

Replace `getMemorySystem()` direct usage with `MemoryService`:

```typescript
// BEFORE
import { getMemorySystem } from './memory/index.js';

// AFTER  
import { getMemoryService, MemoryService } from './memory-service.js';

// In constructor:
// BEFORE
constructor(agents?: AgentDefinition[], memoryClient?: ReturnType<typeof getMemorySystem>)

// AFTER
constructor(agents?: AgentDefinition[], memoryService?: MemoryService)
```

The `queryContext()` and `saveResults()` methods should use `memoryService` instead of calling `getMemorySystem()` directly.

#### `src/memory-client.ts` (DEPRECATE/DELETE)

This file should be **removed** from the main execution path. It can be kept in the repo for reference or for external MCP connections, but boomerang-v2 should not use it internally.

**Rationale**: The MCP client spawns `bun run src/server.ts` which is the SAME codebase. This is circular, wasteful, and adds failure modes (stdio transport, JSON serialization, process management) for zero benefit.

#### `src/server.ts` (KEEP AS-IS)

The MCP server remains the standalone entry point for **external** users who want to use Super-Memory-TS as an MCP server. Boomerang-v2 should not consume it internally.

For packaging:
- `src/server.ts` becomes the entry point for `@veedubin/super-memory-ts` npm package
- `src/memory/`, `src/project-index/`, `src/model/` are the core modules exported by that package
- Boomerang-v2 imports `@veedubin/super-memory-ts` for direct use

### Dependency Structure

```
@veedubin/super-memory-ts (published package)
├── src/memory/         (vector DB, search, operations)
├── src/project-index/  (indexer, watcher, chunker, search)
├── src/model/          (embedding models)
└── src/server.ts       (MCP server for external users)

@veedubin/boomerang-v2 (this package)
├── imports super-memory-ts core directly
├── src/memory-service.ts    (wraps core for boomerang use)
├── src/orchestrator.ts      (uses MemoryService directly)
├── src/task-executor.ts     (uses MemoryService directly)
└── src/server.ts            (NOT USED internally — for external only)
```

### Dual-Use Case Resolution

| Use Case | Integration |
|----------|-------------|
| **Boomerang internal** | Import `MemoryService` from `src/memory-service.ts` (uses core directly) |
| **External MCP users** | Run `src/server.ts` as standalone MCP server |
| **Published package consumers** | `npm install @veedubin/super-memory-ts` → import core or run MCP server |

---

## Part 2: Fix Enforcement Gaps

### Problem

The Boomerang Protocol specifies mandatory steps, but they are only enforced via prompts (honor system):

1. Query memory first → agents told to do it, no validation
2. Sequential thinking → agents told to use it, no enforcement
3. Save at end → agents told to save, no validation
4. Git check before changes → suggested, not enforced
5. Quality gates after changes → suggested, not enforced

### Solution: Protocol Enforcement Middleware

Implement a code-level enforcement system that validates required protocol steps and can auto-remediate violations.

#### File: `src/protocol/tracker.ts` (NEW)

Per-session tracking of all protocol-relevant actions:

```typescript
export interface ProtocolCheckpoint {
  memoryQueried: boolean;
  sequentialThinkingUsed: boolean;
  memorySaved: boolean;
  gitChecked: boolean;
  qualityGatesRun: boolean;
  codeChangesMade: boolean;
}

export interface ToolCallRecord {
  toolName: string;
  timestamp: number;
  args: Record<string, unknown>;
}

export class ProtocolTracker {
  private sessions = new Map<string, {
    checkpoints: ProtocolCheckpoint;
    toolCalls: ToolCallRecord[];
    startTime: number;
    lastActivity: number;
  }>();

  getOrCreateSession(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        checkpoints: {
          memoryQueried: false,
          sequentialThinkingUsed: false,
          memorySaved: false,
          gitChecked: false,
          qualityGatesRun: false,
          codeChangesMade: false,
        },
        toolCalls: [],
        startTime: Date.now(),
        lastActivity: Date.now(),
      });
    }
    return this.sessions.get(sessionId)!;
  }

  recordToolCall(sessionId: string, toolName: string, args: Record<string, unknown>) {
    const session = this.getOrCreateSession(sessionId);
    session.toolCalls.push({ toolName, timestamp: Date.now(), args });
    session.lastActivity = Date.now();

    // Auto-detect protocol compliance
    if (toolName.includes('query_memories') || toolName.includes('search_project')) {
      session.checkpoints.memoryQueried = true;
    }
    if (toolName.includes('sequential_thinking') || toolName.includes('sequentialthinking')) {
      session.checkpoints.sequentialThinkingUsed = true;
    }
    if (toolName.includes('add_memory') || toolName.includes('save')) {
      session.checkpoints.memorySaved = true;
    }
    if (toolName.includes('git_status') || toolName.includes('git_status')) {
      session.checkpoints.gitChecked = true;
    }
  }

  getCheckpoints(sessionId: string): ProtocolCheckpoint {
    return this.getOrCreateSession(sessionId).checkpoints;
  }

  markCodeChanges(sessionId: string) {
    this.getOrCreateSession(sessionId).checkpoints.codeChangesMade = true;
  }

  markQualityGatesRun(sessionId: string) {
    this.getOrCreateSession(sessionId).checkpoints.qualityGatesRun = true;
  }

  clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}

export const protocolTracker = new ProtocolTracker();
```

#### File: `src/protocol/enforcer.ts` (NEW)

Code-level enforcement with auto-remediation:

```typescript
import { protocolTracker, type ProtocolCheckpoint } from './tracker.js';
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
  autoFix: boolean; // Attempt automatic remediation
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

  /**
   * Validate pre-conditions before agent execution
   */
  async validatePreConditions(sessionId: string, taskDescription: string): Promise<EnforcementResult> {
    const checkpoints = protocolTracker.getCheckpoints(sessionId);
    const violations: Violation[] = [];
    const autoFixed: Violation[] = [];

    // Rule 1: Memory must be queried first
    if (this.config.enforceMemoryQuery && !checkpoints.memoryQueried) {
      const violation: Violation = {
        rule: 'memory-query',
        severity: 'error',
        message: 'Memory was not queried before starting work',
        autoFixable: true,
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
        } catch {
          // Auto-fix failed, keep violation
        }
      }
    }

    // Rule 2: Sequential thinking for complex tasks
    if (this.config.enforceSequentialThinking && !checkpoints.sequentialThinkingUsed) {
      const isComplex = this.isComplexTask(taskDescription);
      if (isComplex) {
        violations.push({
          rule: 'sequential-thinking',
          severity: 'warning',
          message: 'Complex task should use sequential-thinking before execution',
          autoFixable: false, // Cannot auto-inject thinking, agent must do it
        });
      }
    }

    return {
      passed: violations.length === 0 || autoFixed.length === violations.length,
      violations,
      autoFixed,
    };
  }

  /**
   * Validate post-conditions after agent execution
   */
  async validatePostConditions(sessionId: string): Promise<EnforcementResult> {
    const checkpoints = protocolTracker.getCheckpoints(sessionId);
    const violations: Violation[] = [];
    const autoFixed: Violation[] = [];

    // Rule 3: Memory must be saved at end
    if (this.config.enforceMemorySave && !checkpoints.memorySaved) {
      const violation: Violation = {
        rule: 'memory-save',
        severity: 'error',
        message: 'Results were not saved to memory',
        autoFixable: true,
      };
      violations.push(violation);

      if (this.config.autoFix) {
        try {
          const memoryService = getMemoryService();
          if (memoryService.isInitialized()) {
            await memoryService.addMemory({
              content: `Task completed for session ${sessionId}`,
              sourceType: 'conversation',
              sessionId,
            });
            protocolTracker.recordToolCall(sessionId, 'add_memory', { sessionId });
            autoFixed.push(violation);
          }
        } catch {
          // Auto-fix failed
        }
      }
    }

    // Rule 4: Quality gates must run after code changes
    if (this.config.enforceQualityGates && checkpoints.codeChangesMade && !checkpoints.qualityGatesRun) {
      violations.push({
        rule: 'quality-gates',
        severity: 'error',
        message: 'Code changes were made but quality gates were not run',
        autoFixable: false,
      });
    }

    return {
      passed: violations.length === 0 || autoFixed.length === violations.length,
      violations,
      autoFixed,
    };
  }

  /**
   * Enforce git check before code changes
   */
  async enforceGitCheck(sessionId: string): Promise<{ clean: boolean; branch?: string; error?: string }> {
    if (!this.config.enforceGitCheck) {
      return { clean: true };
    }

    try {
      // Use git status via child_process
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

  /**
   * Enforce quality gates after code changes
   */
  async enforceQualityGates(sessionId: string): Promise<{ passed: boolean; errors: string[] }> {
    if (!this.config.enforceQualityGates) {
      return { passed: true, errors: [] };
    }

    const errors: string[] = [];

    try {
      // Type check
      const { execSync } = await import('child_process');
      try {
        execSync('bun run typecheck', { encoding: 'utf-8', cwd: process.cwd() });
      } catch {
        errors.push('Type check failed');
      }

      // Tests
      try {
        execSync('bun test --run', { encoding: 'utf-8', cwd: process.cwd() });
      } catch {
        errors.push('Tests failed');
      }

      protocolTracker.markQualityGatesRun(sessionId);
      
      return { passed: errors.length === 0, errors };
    } catch (error) {
      return { passed: false, errors: [error instanceof Error ? error.message : 'Quality gates failed'] };
    }
  }

  private isComplexTask(description: string): boolean {
    // Heuristics for complex tasks
    const complexIndicators = [
      'architect', 'design', 'refactor', 'implement',
      'multiple', 'complex', 'integration', 'orchestrat'
    ];
    const lowerDesc = description.toLowerCase();
    return complexIndicators.some(ind => lowerDesc.includes(ind)) || description.length > 100;
  }
}
```

#### File: `src/middleware/pipeline.ts` (NEW)

Composable middleware for agent execution:

```typescript
export type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

export interface MiddlewareContext {
  sessionId: string;
  taskId: string;
  agent: string;
  taskDescription: string;
  metadata: Record<string, unknown>;
}

export class MiddlewarePipeline {
  private middlewares: MiddlewareFn[] = [];

  use(fn: MiddlewareFn): void {
    this.middlewares.push(fn);
  }

  async execute(ctx: MiddlewareContext, finalHandler: () => Promise<void>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(ctx, next);
      } else {
        await finalHandler();
      }
    };

    await next();
  }
}

export const globalMiddleware = new MiddlewarePipeline();
```

### Integration Points

#### `src/task-executor.ts` (MODIFY)

Wrap task execution with middleware and enforcement:

```typescript
import { ProtocolEnforcer, DEFAULT_ENFORCEMENT_CONFIG } from './protocol/enforcer.js';
import { globalMiddleware, type MiddlewareContext } from './middleware/pipeline.js';
import { protocolTracker } from './protocol/tracker.js';

// In TaskExecutor.executeSingle():
async executeSingle(task: Task): Promise<TaskResult> {
  const startTime = Date.now();
  const sessionId = this.getSessionId(); // From context
  const enforcer = new ProtocolEnforcer(DEFAULT_ENFORCEMENT_CONFIG);

  try {
    // PRE-CONDITION CHECKS
    const preCheck = await enforcer.validatePreConditions(sessionId, task.description);
    if (!preCheck.passed && preCheck.autoFixed.length !== preCheck.violations.length) {
      return {
        taskId: task.id,
        success: false,
        output: '',
        error: `Protocol violations: ${preCheck.violations.map(v => v.message).join(', ')}`,
        duration: Date.now() - startTime,
      };
    }

    // Git check before code changes
    const gitCheck = await enforcer.enforceGitCheck(sessionId);
    if (!gitCheck.clean && task.type === 'code') {
      return {
        taskId: task.id,
        success: false,
        output: '',
        error: `Working tree not clean. Branch: ${gitCheck.branch}. Commit or stash changes first.`,
        duration: Date.now() - startTime,
      };
    }

    // Execute via middleware pipeline
    const ctx: MiddlewareContext = {
      sessionId,
      taskId: task.id,
      agent: task.agent,
      taskDescription: task.description,
      metadata: {},
    };

    let result: string;
    await globalMiddleware.execute(ctx, async () => {
      result = await this.executeWithTimeout(task);
    });

    // Track code changes
    if (task.type === 'code') {
      protocolTracker.markCodeChanges(sessionId);
    }

    // POST-CONDITION CHECKS
    const postCheck = await enforcer.validatePostConditions(sessionId);
    if (!postCheck.passed) {
      return {
        taskId: task.id,
        success: false,
        output: result!,
        error: `Post-execution protocol violations: ${postCheck.violations.map(v => v.message).join(', ')}`,
        duration: Date.now() - startTime,
      };
    }

    // Quality gates after code changes
    if (task.type === 'code') {
      const quality = await enforcer.enforceQualityGates(sessionId);
      if (!quality.passed) {
        return {
          taskId: task.id,
          success: false,
          output: result!,
          error: `Quality gates failed: ${quality.errors.join(', ')}`,
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      taskId: task.id,
      success: true,
      output: result!,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskId: task.id,
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}
```

---

## Part 3: Fix Automation Gaps

### 3.1 Context Usage Monitoring

#### File: `src/context/monitor.ts` (NEW)

```typescript
export interface ContextThreshold {
  percent: number;
  action: 'warn' | 'compact' | 'handoff';
  callback?: () => void | Promise<void>;
}

export class ContextMonitor {
  private currentTokens = 0;
  private maxTokens: number;
  private thresholds: ContextThreshold[] = [];
  private triggeredThresholds = new Set<number>();

  constructor(maxTokens: number = 128000) { // Default to 128k context
    this.maxTokens = maxTokens;
    this.thresholds = [
      { percent: 40, action: 'compact' },
      { percent: 80, action: 'handoff' },
    ];
  }

  /**
   * Update context usage from external source (OpenCode plugin API)
   */
  updateUsage(tokensUsed: number): void {
    this.currentTokens = tokensUsed;
    this.checkThresholds();
  }

  /**
   * Estimate usage from text length (fallback when exact tokens unavailable)
   */
  estimateUsage(text: string): void {
    // Rough estimate: 1 token ≈ 4 characters
    this.currentTokens = Math.ceil(text.length / 4);
    this.checkThresholds();
  }

  /**
   * Get current usage percentage
   */
  getUsagePercent(): number {
    return (this.currentTokens / this.maxTokens) * 100;
  }

  /**
   * Register custom threshold
   */
  onThreshold(percent: number, action: ContextThreshold['action'], callback?: () => void | Promise<void>): void {
    this.thresholds.push({ percent, action, callback });
    this.thresholds.sort((a, b) => a.percent - b.percent);
  }

  /**
   * Reset triggered thresholds (e.g., after compaction)
   */
  reset(): void {
    this.triggeredThresholds.clear();
    this.currentTokens = 0;
  }

  private checkThresholds(): void {
    const currentPercent = this.getUsagePercent();
    
    for (const threshold of this.thresholds) {
      if (currentPercent >= threshold.percent && !this.triggeredThresholds.has(threshold.percent)) {
        this.triggeredThresholds.add(threshold.percent);
        this.executeAction(threshold);
      }
    }
  }

  private async executeAction(threshold: ContextThreshold): Promise<void> {
    switch (threshold.action) {
      case 'warn':
        console.warn(`[ContextMonitor] Warning: Context at ${threshold.percent}%`);
        break;
      case 'compact':
        console.warn(`[ContextMonitor] Compaction triggered at ${threshold.percent}%`);
        break;
      case 'handoff':
        console.error(`[ContextMonitor] Handoff required at ${threshold.percent}%`);
        break;
    }

    if (threshold.callback) {
      await threshold.callback();
    }
  }
}

export const contextMonitor = new ContextMonitor();
```

#### File: `src/context/compactor.ts` (NEW)

```typescript
import { contextMonitor } from './monitor.js';
import { getMemoryService } from '../memory-service.js';
import { protocolTracker } from '../protocol/tracker.js';

export interface CompactionResult {
  success: boolean;
  summary: string;
  savedContext: string;
}

export class ContextCompactor {
  /**
   * Compact context by saving to memory and generating summary
   */
  async compact(sessionId: string): Promise<CompactionResult> {
    try {
      const memoryService = getMemoryService();
      const session = protocolTracker.getOrCreateSession(sessionId);

      // Generate summary of work so far
      const summary = this.generateSummary(session);

      // Save to memory
      await memoryService.addMemory({
        content: `Session compaction summary: ${summary}`,
        sourceType: 'conversation',
        sessionId,
        metadata: { type: 'compaction', timestamp: Date.now() },
      });

      // Reset context monitor
      contextMonitor.reset();

      return {
        success: true,
        summary,
        savedContext: sessionId,
      };
    } catch (error) {
      return {
        success: false,
        summary: '',
        savedContext: error instanceof Error ? error.message : 'Compaction failed',
      };
    }
  }

  private generateSummary(session: ReturnType<typeof protocolTracker.getOrCreateSession>): string {
    const toolCalls = session.toolCalls;
    const uniqueTools = [...new Set(toolCalls.map(t => t.toolName))];
    const duration = Date.now() - session.startTime;

    return [
      `Tools used: ${uniqueTools.join(', ')}`,
      `Total tool calls: ${toolCalls.length}`,
      `Session duration: ${Math.round(duration / 1000)}s`,
      `Protocol compliance: ${JSON.stringify(session.checkpoints)}`,
    ].join('; ');
  }
}

export const contextCompactor = new ContextCompactor();
```

### Integration with Orchestrator

In `src/orchestrator.ts`, integrate context monitoring:

```typescript
import { contextMonitor } from './context/monitor.js';
import { contextCompactor } from './context/compactor.js';

// In constructor or init:
contextMonitor.onThreshold(40, 'compact', async () => {
  // Trigger handoff/compaction
  const result = await contextCompactor.compact(this.sessionId);
  if (result.success) {
    console.log(`[Context] Compacted: ${result.summary}`);
  }
});

contextMonitor.onThreshold(80, 'handoff', async () => {
  // Force handoff — save and request new session
  await contextCompactor.compact(this.sessionId);
  throw new Error('CONTEXT_FULL_HANDOFF_REQUIRED: Context window at 80%. Start a new session.');
});
```

### 3.2 Metrics Collection (Actually Wired Up)

#### File: `src/metrics/collector.ts` (NEW)

```typescript
import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export type MetricsEventType = 
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'memory.queried'
  | 'memory.saved'
  | 'routing.decision'
  | 'context.compaction'
  | 'protocol.violation';

export interface MetricsEvent {
  type: MetricsEventType;
  timestamp: number;
  sessionId: string;
  data: Record<string, unknown>;
}

export class MetricsCollector {
  private buffer: MetricsEvent[] = [];
  private flushIntervalMs = 5000;
  private bufferSize = 100;
  private storagePath: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(storagePath = '.opencode/boomerang-metrics.jsonl') {
    this.storagePath = storagePath;
    this.startFlushTimer();
  }

  emit(event: Omit<MetricsEvent, 'timestamp'>): void {
    const fullEvent: MetricsEvent = {
      ...event,
      timestamp: Date.now(),
    };
    this.buffer.push(fullEvent);

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await mkdir(dirname(this.storagePath), { recursive: true });
      const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await appendFile(this.storagePath, lines);
    } catch (error) {
      console.error('Metrics flush failed:', error);
      // Put events back in buffer
      this.buffer.unshift(...events);
    }
  }

  async query(options: {
    since?: number;
    type?: MetricsEventType;
    sessionId?: string;
    limit?: number;
  } = {}): Promise<MetricsEvent[]> {
    // Simple implementation: read file, filter, return
    // For production, consider using a proper query engine
    const { readFile } = await import('fs/promises');
    try {
      const content = await readFile(this.storagePath, 'utf-8');
      const events = content
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as MetricsEvent);

      return events
        .filter(e => !options.since || e.timestamp >= options.since)
        .filter(e => !options.type || e.type === options.type)
        .filter(e => !options.sessionId || e.sessionId === options.sessionId)
        .slice(-(options.limit ?? 1000));
    } catch {
      return [];
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export const metricsCollector = new MetricsCollector();
```

### Integration Points for Metrics

In `src/task-executor.ts`:

```typescript
import { metricsCollector } from './metrics/collector.js';

// In executeSingle(), wrap with metrics:
async executeSingle(task: Task): Promise<TaskResult> {
  const startTime = Date.now();
  
  metricsCollector.emit({
    type: 'task.started',
    sessionId: this.sessionId,
    data: { taskId: task.id, agent: task.agent, taskType: task.type },
  });

  try {
    const result = await this.executeWithTimeout(task);
    const duration = Date.now() - startTime;

    metricsCollector.emit({
      type: 'task.completed',
      sessionId: this.sessionId,
      data: { taskId: task.id, duration, success: true },
    });

    return { taskId: task.id, success: true, output: result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    metricsCollector.emit({
      type: 'task.failed',
      sessionId: this.sessionId,
      data: { taskId: task.id, duration, error: error instanceof Error ? error.message : 'Unknown' },
    });

    return { taskId: task.id, success: false, output: '', error: error instanceof Error ? error.message : 'Unknown', duration };
  }
}
```

In `src/orchestrator.ts`:

```typescript
import { metricsCollector } from './metrics/collector.js';

// In planTask():
metricsCollector.emit({
  type: 'routing.decision',
  sessionId: this.sessionId,
  data: { taskType, agent: assignedAgent, method: 'keyword' },
});
```

### 3.3 ML-Based Routing (Weighted Scoring Router)

#### File: `src/routing/scoring-router.ts` (NEW)

Uses collected metrics to make informed routing decisions. Falls back to keyword routing when insufficient data.

```typescript
import { metricsCollector } from '../metrics/collector.js';

export interface AgentScore {
  agent: string;
  score: number;
  factors: {
    successRate: number;
    avgLatency: number;
    sampleCount: number;
  };
}

export interface RoutingPreferences {
  optimizeFor: 'speed' | 'quality' | 'balanced';
  maxLatencyMs?: number;
}

export class ScoringRouter {
  private minSamples = 5;

  async selectAgent(taskType: string, preferences: RoutingPreferences = { optimizeFor: 'balanced' }): Promise<AgentScore> {
    // Get all agents that handle this task type
    const candidates = this.getCandidateAgents(taskType);
    
    // Query metrics for historical performance
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000; // Last 30 days
    const events = await metricsCollector.query({ since, type: 'task.completed' });

    // Score each candidate
    const scores = await Promise.all(
      candidates.map(async (agent) => {
        const agentEvents = events.filter(e => e.data.agent === agent && e.data.taskType === taskType);
        const successEvents = agentEvents.filter(e => e.data.success === true);
        
        const sampleCount = agentEvents.length;
        const successRate = sampleCount > 0 ? successEvents.length / sampleCount : 0.5;
        const avgLatency = sampleCount > 0
          ? agentEvents.reduce((sum, e) => sum + (e.data.duration as number), 0) / sampleCount
          : 5000;

        // Calculate weighted score
        let score: number;
        switch (preferences.optimizeFor) {
          case 'speed':
            score = (successRate * 0.3) + ((1 / (1 + avgLatency / 1000)) * 0.7);
            break;
          case 'quality':
            score = (successRate * 0.8) + ((1 / (1 + avgLatency / 1000)) * 0.2);
            break;
          default: // balanced
            score = (successRate * 0.5) + ((1 / (1 + avgLatency / 1000)) * 0.5);
        }

        // Penalize if insufficient samples
        if (sampleCount < this.minSamples) {
          score *= 0.8;
        }

        return {
          agent,
          score,
          factors: { successRate, avgLatency, sampleCount },
        };
      })
    );

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // If top score is too low or has no samples, fall back to keyword routing
    if (scores.length === 0 || scores[0].factors.sampleCount < this.minSamples) {
      const fallbackAgent = this.keywordFallback(taskType);
      return {
        agent: fallbackAgent,
        score: 0.5,
        factors: { successRate: 0.5, avgLatency: 5000, sampleCount: 0 },
      };
    }

    return scores[0];
  }

  private getCandidateAgents(taskType: string): string[] {
    // Return agents that can handle this task type
    const agentMap: Record<string, string[]> = {
      explore: ['boomerang-explorer', 'boomerang-coder'],
      write: ['boomerang-writer', 'boomerang-coder'],
      test: ['boomerang-tester', 'boomerang-coder'],
      review: ['boomerang-architect', 'boomerang-coder'],
      git: ['boomerang-git', 'boomerang-coder'],
      code: ['boomerang-coder', 'boomerang-explorer'],
      general: ['boomerang'],
    };
    return agentMap[taskType] || ['boomerang'];
  }

  private keywordFallback(taskType: string): string {
    // Use existing keyword routing as fallback
    const fallbackMap: Record<string, string> = {
      explore: 'boomerang-explorer',
      write: 'boomerang-writer',
      test: 'boomerang-tester',
      review: 'boomerang-architect',
      git: 'boomerang-git',
      code: 'boomerang-coder',
      general: 'boomerang',
    };
    return fallbackMap[taskType] || 'boomerang';
  }
}

export const scoringRouter = new ScoringRouter();
```

### Integration with Orchestrator

In `src/orchestrator.ts`:

```typescript
import { scoringRouter } from './routing/scoring-router.js';

// In planTask():
async planTask(request: string): Promise<TaskGraph> {
  const subtasks = this.parseRequest(request);
  
  const tasks: Task[] = await Promise.all(
    subtasks.map(async (desc, idx) => {
      const type = detectTaskType(desc);
      
      // Use scoring router if metrics available, else keyword
      const routing = await scoringRouter.selectAgent(type);
      
      return {
        id: generateTaskId(),
        type,
        description: desc,
        agent: routing.agent,
        dependencies: [],
        status: 'pending',
      };
    })
  );
  
  // ... rest of method
}
```

**Note**: True ML-based routing (neural network, embeddings, etc.) is future work. The weighted scoring router above is the practical implementation that uses collected metrics.

---

## Part 4: File Structure Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/memory-service.ts` | Direct integration service replacing MCP client |
| `src/protocol/tracker.ts` | Per-session protocol compliance tracking |
| `src/protocol/enforcer.ts` | Code-level protocol enforcement with auto-remediation |
| `src/middleware/pipeline.ts` | Composable middleware for agent execution |
| `src/context/monitor.ts` | Context window usage monitoring |
| `src/context/compactor.ts` | Automatic compaction logic |
| `src/metrics/collector.ts` | Event-driven metrics collection |
| `src/metrics/store.ts` | Metrics storage abstraction |
| `src/routing/scoring-router.ts` | Metrics-informed agent routing |
| `src/types/protocol.ts` | Shared protocol types |

### Files to Modify

| File | Changes |
|------|---------|
| `src/index.ts` | Use MemoryService instead of MemoryClient |
| `src/orchestrator.ts` | Integrate MemoryService, protocol enforcer, context monitor, scoring router |
| `src/task-executor.ts` | Integrate middleware pipeline, metrics emission, protocol validation |
| `src/server.ts` | Keep as external MCP server entry point |
| `package.json` | Move `@modelcontextprotocol/sdk` to devDependencies or keep for server.ts |
| `AGENTS.md` | Update protocol docs to reflect built-in integration |

### Files to Delete/Deprecate

| File | Action |
|------|--------|
| `src/memory-client.ts` | **Delete** or move to `src/legacy/` — internal code should not use MCP to talk to itself |

---

## Part 5: Implementation Order

### Phase 1: Restore Built-in Integration (Priority: CRITICAL)
**Duration**: 1-2 days
**Dependencies**: None

1. Create `src/memory-service.ts` with direct imports from `src/memory/` and `src/project-index/`
2. Modify `src/index.ts` to use `MemoryService` instead of `MemoryClient`
3. Modify `src/orchestrator.ts` to use `MemoryService`
4. Remove `src/memory-client.ts` from main execution path
5. Update `AGENTS.md` documentation
6. **Test**: Verify memory operations work without MCP indirection

### Phase 2: Protocol Enforcement (Priority: HIGH)
**Duration**: 2-3 days
**Dependencies**: Phase 1

1. Create `src/protocol/tracker.ts` for session tracking
2. Create `src/protocol/enforcer.ts` for validation and auto-remediation
3. Create `src/middleware/pipeline.ts` for composable middleware
4. Modify `src/task-executor.ts` to:
   - Call pre-condition checks before execution
   - Run git check before code changes
   - Call post-condition checks after execution
   - Run quality gates after code changes
   - Integrate middleware pipeline
5. **Test**: Verify violations are caught and auto-fixed

### Phase 3: Metrics Collection (Priority: HIGH)
**Duration**: 1-2 days
**Dependencies**: None (but integrates with Phase 2)

1. Create `src/metrics/collector.ts` with event system
2. Create `src/metrics/store.ts` with JSONL backend
3. Add event emission to `src/task-executor.ts` (task start/complete/fail)
4. Add event emission to `src/orchestrator.ts` (routing decisions)
5. Add event emission to protocol enforcer (violations)
6. **Test**: Verify metrics file is written and queryable

### Phase 4: Context Monitoring & Compaction (Priority: MEDIUM)
**Duration**: 1-2 days
**Dependencies**: Phase 1, Phase 3

1. Create `src/context/monitor.ts` with threshold detection
2. Create `src/context/compactor.ts` with save-and-summarize logic
3. Integrate with orchestrator lifecycle
4. Register 40% compaction and 80% handoff callbacks
5. **Test**: Verify thresholds trigger correctly

### Phase 5: Intelligent Routing (Priority: MEDIUM)
**Duration**: 1-2 days
**Dependencies**: Phase 3

1. Create `src/routing/scoring-router.ts` with weighted scoring
2. Integrate with `src/orchestrator.ts` planTask()
3. Keep keyword fallback for low-sample scenarios
4. **Test**: Verify routing uses metrics when available

### Parallelization

- **Phase 1 and Phase 3 can start in parallel** (metrics collection doesn't depend on integration method)
- **Phase 2 must wait for Phase 1** (enforcement needs the direct integration to be stable)
- **Phase 4 depends on Phase 1** (context monitor needs memory service for compaction)
- **Phase 5 depends on Phase 3** (routing needs metrics)

```
Phase 1 (Integration) ──┬──→ Phase 2 (Enforcement) ──┐
                        │                            ├──→ Done
Phase 3 (Metrics) ──────┴──→ Phase 5 (Routing) ─────┘
                        │
                        └──→ Phase 4 (Context Monitor)
```

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Removing MCP client breaks external integrations | Keep `src/server.ts` as external entry point; only remove internal usage |
| Protocol enforcement too strict | Make enforcement configurable via `EnforcementConfig` |
| Metrics I/O overhead | Buffer + async flush; negligible impact |
| Context estimation inaccurate | Accept estimation as best-effort; rely on host when available |
| Routing with insufficient data | Fallback to keyword routing; require 5+ samples before trusting metrics |

---

## Appendix: Testing Checklist

### Integration Tests
- [ ] MemoryService.queryMemories() returns results without MCP
- [ ] MemoryService.addMemory() stores entries without MCP
- [ ] MemoryService.searchProject() searches indexed files without MCP
- [ ] MemoryService.indexProject() indexes files without MCP
- [ ] Orchestrator uses MemoryService directly

### Enforcement Tests
- [ ] Agent without memory query is blocked or auto-fixed
- [ ] Code changes without git check are blocked
- [ ] Code changes without quality gates are blocked
- [ ] Post-execution without memory save is blocked or auto-fixed

### Metrics Tests
- [ ] task.started events are emitted
- [ ] task.completed events include duration
- [ ] task.failed events include error
- [ ] Metrics file is written to disk
- [ ] Metrics query returns correct results

### Context Monitor Tests
- [ ] 40% threshold triggers compaction callback
- [ ] 80% threshold triggers handoff callback
- [ ] Compaction saves summary to memory

### Routing Tests
- [ ] With no metrics, falls back to keyword routing
- [ ] With metrics, selects agent based on success rate
- [ ] Speed preference weights latency higher
- [ ] Quality preference weights success rate higher

---

## Summary

This plan restores the intended architecture by:
1. **Removing the circular MCP indirection** and using direct imports
2. **Adding code-level protocol enforcement** instead of honor-system prompts
3. **Implementing automatic context monitoring** with compaction and handoff
4. **Wiring up metrics collection** that actually works
5. **Adding metrics-informed routing** with keyword fallback

The result is a system where:
- Memory operations have zero serialization overhead
- Protocol compliance is validated automatically
- Context is managed proactively
- Routing improves over time based on real performance data

**Estimated total effort: 6-10 days** (1 developer, sequential phases where required)
