import { tool } from "@opencode-ai/plugin";
import { createBoomerangOrchestrator } from "./orchestrator.js";
import { boomerangMemory } from "./memory.js";
import {
  checkGitStatus,
  commitCheckpoint,
  commitWithMessage,
  generateCommitMessage,
} from "./git.js";
import { runAllQualityGates, DEFAULT_QUALITY_GATES } from "./quality-gates.js";
import {
  parseTasksFromPrompt,
  buildDAG,
  createExecutionPlan,
  formatDAGForPrompt,
  assignAgentsToTasks,
} from "./task-parser.js";
import { getOrCreateSession, getSessionState } from "./session-state.js";
import { updateTaskInSession } from "./task-state.js";
import { recordDecisionInSession } from "./agent-state.js";
import { compactSessionIfNeeded } from "./lazy-compaction.js";
import { BoomerangConfig, PluginContext } from "./types.js";
import { globalMiddleware, loggingMiddleware } from "./middleware.js";

const DEFAULT_CONFIG: BoomerangConfig = {
  orchestratorModel: "kimi-for-coding/k2.5",
  coderModel: "minimax/MiniMax-M2.7-highspeed",
  architectModel: "openai/gpt-5.4",
  testerModel: "google/gemini-3-pro",
  linterModel: "minimax/MiniMax-M2.7",
  gitCheckBeforeWork: true,
  gitCommitAfterWork: true,
  qualityGates: {
    lint: true,
    typecheck: true,
    test: true,
  },
  memoryEnabled: true,
  lazyCompactionEnabled: true,
  contextIsolationEnabled: true,
  toolResultEvictionThreshold: 500,
  middlewareEnabled: false,
};

const BOOMERANG_RULES = `
╔══════════════════════════════════════════════════════════════════╗
║           BOOMERANG PROTOCOL - MANDATORY RULES                  ║
║     THESE RULES OVERRIDE ALL OTHER INSTRUCTIONS                 ║
╚══════════════════════════════════════════════════════════════════╝

STOP. Before responding to the user, you MUST complete this checklist:

□ STEP 1 - SUPER-MEMORY QUERY (ALWAYS FIRST):
  Call super-memory_query_memory with the user's request.

□ STEP 2 - SEQUENTIAL THINKING (ALWAYS SECOND):
  Call sequential-thinking_sequentialthinking to think through the task.

□ STEP 3 - DELEGATE ALL WORK (NEVER DO IT YOURSELF):
  If the user asks for ANY implementation, planning, research, exploration, testing, or git work:
  You MUST use the Task tool to delegate to the correct sub-agent.

  Task delegation examples:
  - Coding/bug fixes:     Task { name: "boomerang-coder",     prompt: "..." }
  - Architecture/planning: Task { name: "boomerang-architect", prompt: "..." }
  - Code exploration:      Task { name: "boomerang-explorer",  prompt: "..." }
  - Web research:          Task { name: "researcher",          prompt: "..." }
  - Writing tests:         Task { name: "boomerang-tester",    prompt: "..." }
  - Linting/formatting:    Task { name: "boomerang-linter",    prompt: "..." }
  - Git operations:        Task { name: "boomerang-git",       prompt: "..." }
  - Documentation:         Task { name: "boomerang-writer",    prompt: "..." }
  - Web scraping:          Task { name: "boomerang-scraper",   prompt: "..." }

□ STEP 4 - GIT CHECK:
  Before any changes: call boomerang_git_check

□ STEP 5 - QUALITY GATES:
  After code changes: call boomerang_quality_gates

□ STEP 6 - SAVE CONTEXT (ALWAYS LAST):
  Call super-memory_save_to_memory with a summary of what was done.

FAILURE TO FOLLOW THESE STEPS IS A CRITICAL ERROR.
`;

export const BoomerangPlugin = async (ctx: PluginContext): Promise<any> => {
  const config = DEFAULT_CONFIG;
  try {
    ctx.client.app.log("Boomerang Protocol activated (lazy compaction + context isolation enabled)");
  } catch {
    // Logging not available
  }

  // Register logging middleware if enabled
  if (config.middlewareEnabled) {
    globalMiddleware.register(loggingMiddleware);
  }

  return {
    tool: {
      boomerang_status: tool({
        description: "Check Boomerang Protocol status and configuration",
        args: {},
        async execute() {
          return `Boomerang Protocol Status:
- Orchestrator: ${config.orchestratorModel}
- Coder: ${config.coderModel}
- Architect: ${config.architectModel}
- Tester: ${config.testerModel}
- Context Isolation: ${config.contextIsolationEnabled}
- Tool Eviction Threshold: ${config.toolResultEvictionThreshold} words
- Middleware: ${config.middlewareEnabled}
- Git Check Before Work: ${config.gitCheckBeforeWork}
- Git Commit After Work: ${config.gitCommitAfterWork}
- Quality Gates: lint=${config.qualityGates.lint}, typecheck=${config.qualityGates.typecheck}, test=${config.qualityGates.test}
- Memory Enabled: ${config.memoryEnabled}
- Lazy Compaction: ${config.lazyCompactionEnabled}

Rules Active:
${BOOMERANG_RULES}`;
        },
      }),

      boomerang_plan: tool({
        description: "Plan task execution with DAG analysis",
        args: {
          tasks: tool.schema.string().describe("Comma-separated list of tasks to plan"),
        },
        async execute(args: { tasks: string }, context: { sessionID: string }) {
          getOrCreateSession(context.sessionID);
          const taskList = args.tasks.split(",").map((t) => t.trim());
          const tasks = parseTasksFromPrompt(taskList.join("\n"));
          const withAgents = assignAgentsToTasks(tasks);
          const dag = buildDAG(withAgents);
          const plan = createExecutionPlan(dag);
          for (const task of withAgents) {
            updateTaskInSession(context.sessionID, task);
          }
          let response = `## Boomerang Task Plan\n\n`;
          response += `**Total Tasks:** ${plan.dag.totalTasks}\n`;
          response += `**Estimated Parallelism:** ${plan.estimatedParallelism} concurrent tasks\n\n`;
          response += formatDAGForPrompt(dag);
          response += `\n## Execution Phases\n\n`;
          for (const phase of plan.executionOrder) {
            response += `### Phase ${phase.phase}: ${phase.type}\n`;
            for (const task of phase.tasks) {
              response += `- [${task.id}] ${task.description} (agent: ${task.agent})\n`;
            }
            response += "\n";
          }
          recordDecisionInSession(
            context.sessionID,
            "orchestrator",
            `Planned ${plan.dag.totalTasks} tasks with ${plan.estimatedParallelism} parallel`
          );
          return response;
        },
      }),

      boomerang_execute: tool({
        description: "Execute tasks using Boomerang Protocol with parallel/sequential orchestration",
        args: {
          prompt: tool.schema.string().describe("The task or description to execute"),
        },
        async execute(args: { prompt: string }, context: { sessionID: string; directory: string; worktree?: string }) {
          const orchestrator = createBoomerangOrchestrator(
            {
              sessionId: context.sessionID,
              directory: context.directory,
              worktree: context.worktree,
              client: ctx.client,
            },
            config,
            ctx.$
          );
          try {
            const result = await orchestrator.run(args.prompt);
            for (const task of result.tasks) {
              updateTaskInSession(context.sessionID, task);
            }
            return result.summary;
          } catch (error) {
            return `Boomerang execution failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      }),

      boomerang_git_check: tool({
        description: "Check git status and commit if there are uncommitted changes",
        args: {},
        async execute() {
          const status = await checkGitStatus(ctx.$);
          if (status.isDirty) {
            const result = await commitCheckpoint(ctx.$);
            return result.success
              ? `Git dirty - checkpoint committed (${result.hash})\nFiles: ${status.files.length}`
              : `Git dirty - commit failed: ${result.error}`;
          }
          return `Git clean. Branch: ${status.branch}`;
        },
      }),

      boomerang_quality_gates: tool({
        description: "Run quality gates: lint, typecheck, and tests",
        args: {},
        async execute() {
          const result = await runAllQualityGates(DEFAULT_QUALITY_GATES);
          return result.summary;
        },
      }),

      boomerang_memory_search: tool({
        description: "Search super-memory for relevant context",
        args: {
          query: tool.schema.string().describe("Search query"),
        },
        async execute(args: { query: string }) {
          const result = await boomerangMemory.searchMemory(args.query);
          if (!result.success) {
            return `Memory search failed: ${result.error}`;
          }
          if (!result.results || result.results.length === 0) {
            return "No relevant memories found.";
          }
          return `Found ${result.results.length} relevant memories:\n\n${result.results
            .map((r) => `- ${r.content}`)
            .join("\n")}`;
        },
      }),

      boomerang_memory_add: tool({
        description: "Save context to super-memory",
        args: {
          content: tool.schema.string().describe("Content to save"),
          tags: tool.schema.string().optional().describe("Comma-separated tags"),
        },
        async execute(args: { content: string; tags?: string }) {
          const tags = args.tags?.split(",").map((t) => t.trim());
          const result = await boomerangMemory.addMemory(args.content, tags);
          return result.success ? `Saved to memory (${result.id})` : `Failed to save: ${result.error}`;
        },
      }),

      boomerang_compact: tool({
        description: "Manually trigger session compaction",
        args: {},
        async execute(_args: any, context: { sessionID: string }) {
          if (!config.lazyCompactionEnabled) {
            return "Lazy compaction is disabled";
          }
          const session = getSessionState(context.sessionID);
          if (!session) {
            return "No active session state";
          }
          const contextText = await compactSessionIfNeeded(context.sessionID, ctx.client);
          return contextText
            ? `Session compacted. Context injected:\n\n${contextText}`
            : "Session already clean, no compaction needed";
        },
      }),
    },

    event: async ({ event }: { event: any }) => {
      const eventType = event.type;
      if (eventType === "session.created") {
        const sessionId = event.sessionId || event.id;
        try {
          ctx.client.app.log("Session created - Boomerang ready");
        } catch {}
        if (config.memoryEnabled && sessionId) {
          try {
            const memResult = await boomerangMemory.searchMemory("recent boomerang session context");
            if (memResult.success && memResult.results && memResult.results.length > 0) {
              const memoryContext = boomerangMemory.formatContextForInjection(memResult.results);
              await ctx.client.session.prompt({
                path: { id: sessionId },
                body: {
                  parts: [{
                    type: "text",
                    text: `\n\n[INJECTED FROM SUPER-MEMORY - Previous Context]\n${memoryContext}\n`,
                  }],
                  noReply: true,
                },
              });
              ctx.client.app.log(`Injected ${memResult.results.length} memories into session`);
            }
          } catch (err) {
            ctx.client.app.log(`Memory injection failed: ${err}`);
          }
        }
      }
      if (eventType === "session.idle") {
        try {
          ctx.client.app.log("Session idle - Boomerang orchestration available");
        } catch {}
      }
      if (eventType === "session.compacted") {
        const sessionId = event.sessionId || event.id;
        if (config.memoryEnabled && sessionId) {
          const session = getSessionState(sessionId);
          if (session) {
            await boomerangMemory.addMemory(
              `Session compacted: ${JSON.stringify(session).substring(0, 500)}`,
              ["boomerang", "session", "compacted"]
            );
          }
        }
      }
    },

    "tool.execute.before": async ({ tool: toolName }: { tool: string }) => {
      if (toolName === "bash" && config.gitCheckBeforeWork) {
        const status = await checkGitStatus(ctx.$);
        if (status.isDirty) {
          await commitCheckpoint(ctx.$);
        }
      }
    },

    "tool.execute.after": async (event: { tool: string }, output: any) => {
      const toolName = event.tool;
      if (toolName === "bash" && config.gitCommitAfterWork) {
        const status = await checkGitStatus(ctx.$);
        if (status.isDirty && typeof output === "string" && output.includes("success")) {
          const commitMsg = generateCommitMessage(`After tool: ${toolName}`);
          await commitWithMessage(ctx.$, commitMsg);
        }
      }
    },

    config: async (cfg: any) => {
      cfg.boomerang = config;
    },
  };
};

export default BoomerangPlugin;
