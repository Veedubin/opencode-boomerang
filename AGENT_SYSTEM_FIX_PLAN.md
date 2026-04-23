# Boomerang Agent System — Comprehensive Implementation Plan

## Executive Summary

This plan addresses three critical failures in the current agent system:
1. **One-line prompts** that cause agents to fixate on identity repetition
2. **Zero loop/recursion guards** that allow runaway execution
3. **No termination signals** causing agents to get stuck in infinite response loops

The solution introduces: comprehensive multi-section prompts (200-400 words each), a 5-layer loop prevention system, execution depth tracking, semantic loop detection, timeout guards, and early stopping with forced summary generation.

---

## 1. New Types (`types.ts`)

Add the following new interfaces and update existing ones:

```typescript
/**
 * Execution Configuration
 * Controls safety limits for agent task execution.
 */
export interface ExecutionConfig {
  maxIterations: number;              // default: 15
  maxExecutionDepth: number;          // default: 5
  maxExecutionTimeMs: number;         // default: 120000 (2 minutes)
  loopDetectionWindow: number;        // default: 5 (recent outputs to track)
  loopSimilarityThreshold: number;    // default: 0.9 (90%)
  earlyStoppingEnabled: boolean;      // default: true
}

/**
 * Default execution configuration.
 */
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxIterations: 15,
  maxExecutionDepth: 5,
  maxExecutionTimeMs: 120000,
  loopDetectionWindow: 5,
  loopSimilarityThreshold: 0.9,
  earlyStoppingEnabled: true,
};

/**
 * Guard Result — returned by execution guard checks.
 */
export interface GuardResult {
  allowed: boolean;
  reason?: string;
  guardType: "depth" | "iterations" | "loop" | "timeout" | "none";
}

/**
 * Execution Record — audit trail for each task execution.
 */
export interface ExecutionRecord {
  taskId: string;
  agent: AgentType;
  startedAt: number;
  completedAt: number;
  iterations: number;
  stoppedEarly: boolean;
  stopReason?: string;
}

/**
 * Enhanced Session State with execution tracking.
 */
export interface SessionState {
  sessionId: string;
  dirty: boolean;
  completedTasks: Task[];
  pendingTasks: Task[];
  agentDecisions: AgentDecision[];
  createdAt: number;
  lastUsedAt: number;
  notes: Map<string, string>;
  executionDepth: number;             // NEW: current nesting depth
  executionHistory: ExecutionRecord[]; // NEW: audit trail
}

/**
 * Enhanced Task Result with early stopping metadata.
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  stoppedEarly?: boolean;             // true if guard triggered
  stopReason?: string;                // why it stopped
  iterationsUsed?: number;            // how many iterations consumed
}
```

---

## 2. Session State Updates (`session-state.ts`)

Update session creation and add depth/history helpers:

```typescript
import { SessionState, Task, ExecutionRecord } from "./types.js";

const sessions = new Map<string, SessionState>();

export function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      dirty: false,
      completedTasks: [],
      pendingTasks: [],
      agentDecisions: [],
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      notes: new Map(),
      executionDepth: 0,              // NEW
      executionHistory: [],           // NEW
    });
  }
  const session = sessions.get(sessionId)!;
  session.lastUsedAt = Date.now();
  return session;
}

// NEW: Depth tracking
export function incrementExecutionDepth(sessionId: string): number {
  const session = getOrCreateSession(sessionId);
  session.executionDepth = (session.executionDepth || 0) + 1;
  return session.executionDepth;
}

export function decrementExecutionDepth(sessionId: string): number {
  const session = getOrCreateSession(sessionId);
  session.executionDepth = Math.max(0, (session.executionDepth || 0) - 1);
  return session.executionDepth;
}

export function getExecutionDepth(sessionId: string): number {
  const session = getSessionState(sessionId);
  return session?.executionDepth || 0;
}

// NEW: Execution history
export function recordExecution(
  sessionId: string,
  record: ExecutionRecord
): void {
  const session = getOrCreateSession(sessionId);
  if (!session.executionHistory) {
    session.executionHistory = [];
  }
  session.executionHistory.push(record);
  markDirty(sessionId);
}

// Existing functions remain unchanged...
export function getSessionState(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function markDirty(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.dirty = true;
  }
}

export function isDirty(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.dirty ?? false;
}

export function clearDirty(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.dirty = false;
  }
}

export function updateTask(sessionId: string, task: Task): void {
  const session = getOrCreateSession(sessionId);
  const existingIndex = session.pendingTasks.findIndex((t) => t.id === task.id);
  if (existingIndex > -1) {
    session.pendingTasks.splice(existingIndex, 1);
  }
  if (task.status === "completed" || task.status === "failed") {
    const alreadyCompleted = session.completedTasks.find((t) => t.id === task.id);
    if (!alreadyCompleted) {
      session.completedTasks.push(task);
    }
  } else {
    const alreadyPending = session.pendingTasks.find((t) => t.id === task.id);
    if (!alreadyPending) {
      session.pendingTasks.push(task);
    }
  }
  markDirty(sessionId);
}

export function recordDecision(
  sessionId: string,
  agent: string,
  summary: string,
  reasoning?: string
): void {
  const session = getOrCreateSession(sessionId);
  session.agentDecisions.push({
    agent,
    summary,
    reasoning,
    timestamp: new Date().toISOString(),
  });
  markDirty(sessionId);
}

export function addNote(sessionId: string, taskId: string, note: string): void {
  const session = getOrCreateSession(sessionId);
  session.notes.set(taskId, note);
  markDirty(sessionId);
}

export function getSessionContext(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function removeSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getAllDirtySessions(): string[] {
  const dirty: string[] = [];
  for (const [sessionId, session] of sessions) {
    if (session.dirty) {
      dirty.push(sessionId);
    }
  }
  return dirty;
}
```

---

## 3. Comprehensive Prompt Templates

Replace the one-line `AGENT_SYSTEM_PROMPTS` with task-first, multi-section prompts. **Critical rule**: No model name mentions, no identity reassertion loops, explicit `TASK_COMPLETE` signal.

### 3.1 Coder Agent Prompt

```typescript
const CODER_PROMPT = `# Task
{taskDescription}

# Your Role
You produce working, production-ready code. You focus on correctness, clarity, and efficiency. You write code that compiles, passes tests, and follows established conventions of the codebase.

# Execution Rules
1. Read and understand the task requirements fully before writing code.
2. Write the minimal code needed to satisfy the requirements.
3. Follow existing patterns in the codebase when available.
4. Include error handling for edge cases.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler ("Sure!", "Here you go!", "I'll help!").
8. When you have finished writing the code, output TASK_COMPLETE on its own line.
9. If you cannot complete the task, output TASK_COMPLETE with a brief explanation of the blocker.

# Output Format
Provide code in fenced code blocks with the correct language tag. Include brief comments for complex logic. After the code, provide a one-sentence summary of what was implemented.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on deliverables, not on describing yourself.
`;
```

### 3.2 Architect Agent Prompt

```typescript
const ARCHITECT_PROMPT = `# Task
{taskDescription}

# Your Role
You analyze trade-offs and design system structures. You evaluate patterns, dependencies, scalability, and maintainability. You produce clear recommendations with reasoning.

# Execution Rules
1. Analyze the current system context and constraints.
2. Evaluate at least two viable approaches when making design decisions.
3. State your recommendation with clear reasoning.
4. Identify risks and mitigation strategies.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished your analysis, output TASK_COMPLETE on its own line.
9. If the task requires further decomposition, list the sub-tasks needed.

# Output Format
- **Recommendation**: Your primary recommendation in one paragraph.
- **Alternatives Considered**: Brief notes on other options.
- **Risks**: Bullet list of risks and mitigations.
- **Next Steps**: Actionable items if applicable.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on architectural reasoning, not self-description.
`;
```

### 3.3 Tester Agent Prompt

```typescript
const TESTER_PROMPT = `# Task
{taskDescription}

# Your Role
You write comprehensive tests that verify correctness, catch edge cases, and document expected behavior. You aim for high coverage of both happy paths and failure modes.

# Execution Rules
1. Understand the code or requirements under test.
2. Write tests for the main functionality first.
3. Add edge case tests (nulls, empty inputs, boundary values, errors).
4. Use descriptive test names that explain what is being verified.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished writing tests, output TASK_COMPLETE on its own line.
9. If the codebase uses a specific test framework, use that framework.

# Output Format
Provide test code in fenced code blocks. Group related tests. Include a brief comment above each test group explaining what it covers.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on test coverage and correctness, not self-description.
`;
```

### 3.4 Linter Agent Prompt

```typescript
const LINTER_PROMPT = `# Task
{taskDescription}

# Your Role
You enforce code quality standards. You check for style consistency, potential bugs, type safety issues, and adherence to project conventions. You provide actionable fixes.

# Execution Rules
1. Review the provided code or files systematically.
2. Identify issues by severity: critical (bugs), warning (style), info (suggestions).
3. For each issue, provide the file path, line number, and specific fix.
4. Prioritize critical issues over stylistic preferences.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished your review, output TASK_COMPLETE on its own line.
9. If no issues are found, state that clearly and output TASK_COMPLETE.

# Output Format
- **Critical**: File, line, issue, suggested fix.
- **Warnings**: File, line, issue, suggested fix.
- **Info**: Optional suggestions.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on code quality, not self-description.
`;
```

### 3.5 Git Agent Prompt

```typescript
const GIT_PROMPT = `# Task
{taskDescription}

# Your Role
You handle version control operations with discipline. You create meaningful commits, manage branches safely, and avoid destructive operations unless explicitly requested.

# Execution Rules
1. Analyze the current git state before proposing operations.
2. Prefer safe operations; warn before destructive ones (reset, force push, etc.).
3. Write clear, conventional commit messages.
4. Group related changes in single commits when appropriate.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished, output TASK_COMPLETE on its own line.
9. If an operation is risky, explain the risk and ask for confirmation.

# Output Format
List the git commands to run in code blocks. Explain what each command does. If committing, provide the commit message.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on git operations, not self-description.
- Never run 'git push --force' or 'git reset --hard' without explicit warning.
`;
```

### 3.6 Explorer Agent Prompt

```typescript
const EXPLORER_PROMPT = `# Task
{taskDescription}

# Your Role
You navigate codebases to find files, patterns, and structures. You provide precise file paths, line numbers, and relevant code snippets. You map relationships between components.

# Execution Rules
1. Search systematically using the available tools.
2. Report exact file paths and line numbers for findings.
3. Provide relevant code snippets for context.
4. Map how components relate to each other when relevant.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished exploring, output TASK_COMPLETE on its own line.
9. If a search yields no results, state that clearly.

# Output Format
- **Findings**: What you found, with file paths and line numbers.
- **Code Snippets**: Relevant excerpts in fenced blocks.
- **Relationships**: How components connect (if applicable).

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on findings, not self-description.
`;
```

### 3.7 Writer Agent Prompt

```typescript
const WRITER_PROMPT = `# Task
{taskDescription}

# Your Role
You write clear, accurate documentation. You explain concepts for the intended audience, structure information logically, and use consistent formatting.

# Execution Rules
1. Understand the target audience and purpose of the document.
2. Structure content with clear headings and logical flow.
3. Use code examples where they clarify concepts.
4. Keep sentences concise and jargon-free unless writing for experts.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished writing, output TASK_COMPLETE on its own line.
9. If the document references code, ensure the references are accurate.

# Output Format
Use Markdown with proper heading hierarchy. Include a table of contents for long documents. Use fenced code blocks for code examples.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on the document content, not self-description.
`;
```

### 3.8 Scraper Agent Prompt

```typescript
const SCRAPER_PROMPT = `# Task
{taskDescription}

# Your Role
You gather and synthesize information from the web. You verify sources, extract key facts, and present findings in a structured format. You distinguish between facts and speculation.

# Execution Rules
1. Search for relevant, authoritative sources.
2. Extract key facts, figures, and quotes with attribution.
3. Synthesize information from multiple sources when available.
4. Note the date of sources and flag outdated information.
5. Do NOT reiterate your role or identity in your response.
6. Do NOT repeat the task description back to the user.
7. Do NOT include conversational filler.
8. When you have finished researching, output TASK_COMPLETE on its own line.
9. If sources are limited or unreliable, note that limitation.

# Output Format
- **Summary**: Brief synthesis of findings.
- **Key Facts**: Bullet list with source attribution.
- **Sources**: URLs and dates accessed.
- **Gaps**: Information that could not be found.

# Constraints
- No model name mentions.
- No self-referential identity statements.
- Focus on research findings, not self-description.
`;
```

### Prompt Builder Function

```typescript
function buildAgentPrompt(task: TaskWithAgent): string {
  const template = AGENT_PROMPT_TEMPLATES[task.agent] || AGENT_PROMPT_TEMPLATES["coder"];
  return template.replace("{taskDescription}", task.description);
}

const AGENT_PROMPT_TEMPLATES: Record<string, string> = {
  coder: CODER_PROMPT,
  architect: ARCHITECT_PROMPT,
  tester: TESTER_PROMPT,
  linter: LINTER_PROMPT,
  git: GIT_PROMPT,
  explorer: EXPLORER_PROMPT,
  writer: WRITER_PROMPT,
  scraper: SCRAPER_PROMPT,
};
```

---

## 4. Loop Prevention System (`task-executor.ts`)

### 4.1 Loop Detector

```typescript
class LoopDetector {
  private outputHashes: string[] = [];
  private lastOutput: string = "";
  private readonly windowSize: number;
  private readonly similarityThreshold: number;

  constructor(windowSize = 5, similarityThreshold = 0.9) {
    this.windowSize = windowSize;
    this.similarityThreshold = similarityThreshold;
  }

  addOutput(output: string): { isLoop: boolean; reason?: string } {
    const hash = this.hashOutput(output);

    // Check exact hash match in window
    if (this.outputHashes.includes(hash)) {
      return { isLoop: true, reason: "Exact output repetition detected" };
    }

    // Check similarity with last output
    if (this.lastOutput.length > 0) {
      const similarity = this.calculateSimilarity(output, this.lastOutput);
      if (similarity >= this.similarityThreshold) {
        return {
          isLoop: true,
          reason: `Near-identical output detected (${(similarity * 100).toFixed(1)}% similar)`,
        };
      }
    }

    this.outputHashes.push(hash);
    if (this.outputHashes.length > this.windowSize) {
      this.outputHashes.shift();
    }
    this.lastOutput = output;

    return { isLoop: false };
  }

  private hashOutput(output: string): string {
    // Normalize: lowercase, collapse whitespace, trim
    const normalized = output.toLowerCase().replace(/\s+/g, " ").trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return String(hash);
  }

  private calculateSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] =
          b.charAt(i - 1) === a.charAt(j - 1)
            ? matrix[i - 1][j - 1]
            : Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
      }
    }
    return matrix[b.length][a.length];
  }
}
```

### 4.2 Execution Guard

```typescript
class ExecutionGuard {
  private config: ExecutionConfig;
  private loopDetector: LoopDetector;
  private iterationCount: number = 0;
  private startTime: number;
  private depth: number;

  constructor(config: ExecutionConfig, depth: number) {
    this.config = config;
    this.loopDetector = new LoopDetector(
      config.loopDetectionWindow,
      config.loopSimilarityThreshold
    );
    this.startTime = Date.now();
    this.depth = depth;
  }

  check(): GuardResult {
    // Check depth
    if (this.depth > this.config.maxExecutionDepth) {
      return {
        allowed: false,
        guardType: "depth",
        reason: `Max execution depth exceeded (${this.depth} > ${this.config.maxExecutionDepth})`,
      };
    }

    // Check iterations
    if (this.iterationCount >= this.config.maxIterations) {
      return {
        allowed: false,
        guardType: "iterations",
        reason: `Max iterations reached (${this.iterationCount})`,
      };
    }

    // Check timeout
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.config.maxExecutionTimeMs) {
      return {
        allowed: false,
        guardType: "timeout",
        reason: `Execution timeout (${elapsed}ms > ${this.config.maxExecutionTimeMs}ms)`,
      };
    }

    return { allowed: true, guardType: "none" };
  }

  checkOutput(output: string): GuardResult {
    const loopResult = this.loopDetector.addOutput(output);
    if (loopResult.isLoop) {
      return {
        allowed: false,
        guardType: "loop",
        reason: loopResult.reason,
      };
    }
    this.iterationCount++;
    return this.check();
  }

  getStats() {
    return {
      iterations: this.iterationCount,
      elapsed: Date.now() - this.startTime,
      depth: this.depth,
    };
  }
}
```

### 4.3 Timeout Wrapper

```typescript
function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
```

### 4.4 Early Stop Summary Generator

```typescript
async function generateEarlyStopSummary(
  ctx: OrchestratorContext,
  task: TaskWithAgent,
  lastOutput: string,
  guardResult: GuardResult,
  stats: { iterations: number; elapsed: number; depth: number }
): Promise<string> {
  if (!guardResult.reason) return lastOutput;

  const summaryPrompt = `You were working on a task but hit a safety limit. Provide a concise summary of what you accomplished so far.

Task: ${task.description}

Your last output (${stats.iterations} iterations, ${stats.elapsed}ms):
${lastOutput.substring(0, 1500)}

Stop reason: ${guardResult.reason}

Please summarize:
1. What you completed
2. What remains unfinished
3. Any partial results or findings

Be brief and factual. Do NOT apologize or explain the limit. Output TASK_COMPLETE when done.`;

  try {
    const result = await ctx.client.session.prompt({
      path: { id: ctx.sessionId },
      body: {
        parts: [{ type: "text", text: summaryPrompt }],
      },
    });
    return result?.content || lastOutput;
  } catch {
    return `[Execution stopped: ${guardResult.reason}]\n\nLast output:\n${lastOutput}`;
  }
}
```

### 4.5 Updated `executeTaskInSession`

```typescript
export async function executeTaskInSession(
  ctx: OrchestratorContext,
  task: TaskWithAgent,
  _model: string,
  config?: ExecutionConfig
): Promise<TaskResult> {
  const executionConfig = config || DEFAULT_EXECUTION_CONFIG;
  const startTime = Date.now();

  // Track depth
  const depth = incrementExecutionDepth(ctx.sessionId);

  try {
    // Create guard
    const guard = new ExecutionGuard(executionConfig, depth);

    // Initial guard check
    const initialCheck = guard.check();
    if (!initialCheck.allowed) {
      return createEarlyStopResult(task, initialCheck, startTime, "", 0);
    }

    // Build comprehensive prompt
    const promptText = buildAgentPrompt(task);

    // Execute with timeout
    const result = await executeWithTimeout(
      () =>
        ctx.client.session.prompt({
          path: { id: ctx.sessionId },
          body: {
            parts: [{ type: "text", text: promptText }],
          },
        }),
      executionConfig.maxExecutionTimeMs
    );

    const output = result?.content || "";

    // Check output for loops
    const outputCheck = guard.checkOutput(output);
    if (!outputCheck.allowed) {
      // Generate early stop summary if enabled
      let finalOutput = output;
      if (executionConfig.earlyStoppingEnabled) {
        finalOutput = await generateEarlyStopSummary(
          ctx,
          task,
          output,
          outputCheck,
          guard.getStats()
        );
      }
      return createEarlyStopResult(
        task,
        outputCheck,
        startTime,
        finalOutput,
        guard.getStats().iterations
      );
    }

    // Check for TASK_COMPLETE signal
    const hasCompletionSignal = output.includes("TASK_COMPLETE");
    const cleanedOutput = hasCompletionSignal
      ? output.replace(/TASK_COMPLETE/g, "").trim()
      : output;

    // Record execution
    recordExecution(ctx.sessionId, {
      taskId: task.id,
      agent: task.agent,
      startedAt: startTime,
      completedAt: Date.now(),
      iterations: guard.getStats().iterations,
      stoppedEarly: false,
    });

    return {
      taskId: task.id,
      success: true,
      output: cleanedOutput,
      executionTime: Date.now() - startTime,
      iterationsUsed: guard.getStats().iterations,
    };
  } catch (error) {
    return {
      taskId: task.id,
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  } finally {
    decrementExecutionDepth(ctx.sessionId);
  }
}

function createEarlyStopResult(
  task: TaskWithAgent,
  guardResult: GuardResult,
  startTime: number,
  output: string = "",
  iterations: number = 0
): TaskResult {
  return {
    taskId: task.id,
    success: false,
    output: output || `[Stopped: ${guardResult.reason}]`,
    error: guardResult.reason,
    executionTime: Date.now() - startTime,
    stoppedEarly: true,
    stopReason: guardResult.reason,
    iterationsUsed: iterations,
  };
}
```

### 4.6 Updated Batch Execution Functions

```typescript
export async function executeParallelTasks(
  ctx: OrchestratorContext,
  tasks: TaskWithAgent[],
  defaultModel: string,
  config?: ExecutionConfig
): Promise<TaskResult[]> {
  const promises = tasks.map((task) =>
    executeTaskInSession(
      ctx,
      task,
      MODEL_ROUTING[task.agent] || defaultModel,
      config
    )
  );
  return Promise.all(promises);
}

export async function executeSequentialTasks(
  ctx: OrchestratorContext,
  tasks: TaskWithAgent[],
  defaultModel: string,
  config?: ExecutionConfig
): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  for (const task of tasks) {
    const result = await executeTaskInSession(
      ctx,
      task,
      MODEL_ROUTING[task.agent] || defaultModel,
      config
    );
    results.push(result);
    if (!result.success) {
      break;
    }
  }
  return results;
}
```

---

## 5. Orchestrator Integration (`orchestrator.ts`)

Minimal changes to pass execution config through the chain:

```typescript
import {
  ExecutionConfig,
  DEFAULT_EXECUTION_CONFIG,
  // ... other imports
} from "./types.js";

// In BoomerangConfig (types.ts), add:
// executionConfig?: ExecutionConfig;

// In executePlan:
private async executePlan(plan: ExecutionPlan): Promise<PhaseResult[]> {
  const executionConfig = this.config.executionConfig || DEFAULT_EXECUTION_CONFIG;
  const results: PhaseResult[] = [];

  for (const phase of plan.executionOrder) {
    const phaseResult: PhaseResult = {
      phase: phase.phase,
      type: phase.type,
      results: [],
      allSuccess: false,
    };

    const taskList = phase.tasks.map((t) => ({
      id: t.id,
      description: t.description,
      agent: t.agent,
      status: t.status,
      dependencies: t.dependencies,
    }));

    if (this.config.middlewareEnabled) {
      phaseResult.results = await globalMiddleware.execute(
        "before_agent",
        { phase, config: this.config },
        async () => {
          return phase.type === "parallel"
            ? await executeParallelTasks(this.ctx, taskList, this.config.coderModel, executionConfig)
            : await executeSequentialTasks(this.ctx, taskList, this.config.coderModel, executionConfig);
        }
      );
    } else {
      phaseResult.results =
        phase.type === "parallel"
          ? await executeParallelTasks(this.ctx, taskList, this.config.coderModel, executionConfig)
          : await executeSequentialTasks(this.ctx, taskList, this.config.coderModel, executionConfig);
    }

    // Context isolation (unchanged)
    if (this.config.contextIsolationEnabled) {
      phaseResult.results = phaseResult.results.map((result) => {
        if (result.output && result.output.length > 100) {
          const isolated = isolateResult(
            result.output,
            "task",
            result.taskId,
            (raw) => raw.substring(0, 500) + (raw.length > 500 ? "..." : "")
          );
          return { ...result, output: isolated.summary };
        }
        return result;
      });
    }

    phaseResult.allSuccess = phaseResult.results.every((r) => r.success);
    results.push(phaseResult);

    if (!phaseResult.allSuccess && phase.type === "sequential") {
      break;
    }
  }
  return results;
}
```

---

## 6. Anti-Identity-Repetition Measures Summary

| Measure | Implementation |
|---------|---------------|
| **No model name mentions** | Prompts never reference "MiniMax M2.7", "Kimi K2.6", etc. |
| **Task-first structure** | Prompts lead with `# Task`, not identity assertion |
| **Explicit termination signal** | `TASK_COMPLETE` required on completion |
| **Identity suppression rule** | "Do NOT reiterate your role or identity" in every prompt |
| **No conversational filler** | "Do NOT include conversational filler" prevents "Sure! I'll help!" loops |
| **No task repetition** | "Do NOT repeat the task description back" prevents echo loops |
| **Focus on deliverables** | Prompts emphasize output format and constraints, not self-description |

---

## 7. Migration Guide

### Step 1: Update `types.ts`
- Add `ExecutionConfig`, `GuardResult`, `ExecutionRecord`
- Update `SessionState` with `executionDepth` and `executionHistory`
- Update `TaskResult` with `stoppedEarly`, `stopReason`, `iterationsUsed`
- Add `DEFAULT_EXECUTION_CONFIG`

### Step 2: Update `session-state.ts`
- Initialize `executionDepth: 0` and `executionHistory: []` in `getOrCreateSession`
- Add `incrementExecutionDepth`, `decrementExecutionDepth`, `getExecutionDepth`
- Add `recordExecution`

### Step 3: Rewrite `task-executor.ts`
- Replace `AGENT_SYSTEM_PROMPTS` with `AGENT_PROMPT_TEMPLATES`
- Add `LoopDetector` class
- Add `ExecutionGuard` class
- Add `executeWithTimeout` helper
- Add `generateEarlyStopSummary` helper
- Rewrite `executeTaskInSession` with guard wrapping
- Update `executeParallelTasks` and `executeSequentialTasks` signatures

### Step 4: Update `orchestrator.ts`
- Import `ExecutionConfig`, `DEFAULT_EXECUTION_CONFIG`
- Update `executePlan` to pass `executionConfig` to batch functions

### Step 5: Testing
- Verify prompts are 200-400 words each
- Verify `TASK_COMPLETE` signal is present in all prompts
- Verify no model name mentions in prompts
- Test loop detection with repeated identical outputs
- Test max iterations guard
- Test timeout guard
- Test depth limit guard
- Verify early stopping generates summaries

---

## 8. Files Modified Summary

| File | Changes |
|------|---------|
| `types.ts` | +80 lines: new types, updated interfaces, default config |
| `session-state.ts` | +30 lines: depth tracking, execution history |
| `task-executor.ts` | +250 lines: prompts, LoopDetector, ExecutionGuard, timeout, early stopping |
| `orchestrator.ts` | +5 lines: pass execution config through |

**Total estimated change**: ~365 lines added, 20 lines modified.

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Prompts too long → token overflow | Prompts are 200-400 words; well within context limits |
| Loop detector false positives | Similarity threshold at 90%; exact hash match for repeats |
| Timeout too aggressive | Default 120s; configurable per project |
| Early stopping loses work | Summary generator captures partial results |
| Depth tracking overhead | Single integer increment/decrement; negligible |
| Backward compatibility | `ExecutionConfig` is optional; defaults applied automatically |

---

*Plan prepared by Boomerang Architect. Ready for implementation.*
