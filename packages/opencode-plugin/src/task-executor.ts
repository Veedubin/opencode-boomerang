import { TaskWithAgent, TaskResult, PhaseResult, AggregatedResults, ExecutionConfig, DEFAULT_EXECUTION_CONFIG, GuardResult } from "./types.js";
import { OrchestratorContext } from "./types.js";
import { incrementExecutionDepth, decrementExecutionDepth, recordExecution } from "./session-state.js";

export const MODEL_ROUTING: Record<string, string> = {
  orchestrator: "kimi-for-coding/k2.5",
  coder: "minimax/MiniMax-M2.7-highspeed",
  architect: "openai/gpt-5.4",
  tester: "google/gemini-3-pro",
  linter: "minimax/MiniMax-M2.7",
  git: "minimax/MiniMax-M2.7",
  explorer: "minimax/MiniMax-M2.7",
  writer: "kimi-for-coding/k2.5",
  scraper: "minimax/MiniMax-M2.7",
};

// Comprehensive prompt templates - task-first structure, 200-400 words each
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

function buildAgentPrompt(task: TaskWithAgent): string {
  const template = AGENT_PROMPT_TEMPLATES[task.agent] || AGENT_PROMPT_TEMPLATES["coder"];
  return template.replace("{taskDescription}", task.description);
}

// Loop Detector with hash-based detection and Levenshtein similarity
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

// Execution Guard - checks depth, iterations, timeout, and loops
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

// Timeout wrapper
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

// Early stop summary generator
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

// Helper to create early stop result
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

  // Create guard
  const guard = new ExecutionGuard(executionConfig, depth);

  try {
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

    const output = (result as any)?.content || "";

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

export function aggregateResults(phaseResults: PhaseResult[]): AggregatedResults {
  let total = 0;
  let successful = 0;
  let failed = 0;
  for (const phase of phaseResults) {
    for (const result of phase.results) {
      total++;
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
  }
  return {
    totalTasks: total,
    successfulTasks: successful,
    failedTasks: failed,
    allPassed: failed === 0,
  };
}