import { tool } from "@opencode-ai/plugin";
import { createBoomerangOrchestrator } from "./orchestrator.js";
import { boomerangMemory, generateSessionSummary, formatProjectContextForInjection, setProjectSearchClient } from "./memory.js";
import { listAvailableAgents, listAvailableSkills } from "./asset-loader.js";
import { initializeProjectIndexManager, getProjectIndexStatus, searchProjectFiles, isProjectIndexManagerInitialized, getWorkspaceManager } from "./project-index-manager.js";
import { MemoryClient, initializeMemoryClient } from "./memory-client.js";
export { MemoryClient };
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
import { BoomerangConfig, PluginContext, EmbeddingStrategy } from "./types.js";
import { globalMiddleware, loggingMiddleware } from "./middleware.js";

const DEFAULT_CONFIG: BoomerangConfig = {
  orchestratorModel: "kimi-for-coding/k2p6",
  coderModel: "minimax/MiniMax-M2.7",
  architectModel: "kimi-for-coding/k2p6",
  testerModel: "minimax/MiniMax-M2.7",
  linterModel: "minimax/MiniMax-M2.7",
  gitCheckBeforeWork: true,
  gitCommitAfterWork: true,
  qualityGates: {
    lint: true,
    typecheck: true,
    test: true,
  },
  memoryEnabled: true,
  memoryTierConfig: {
    strategy: (process.env.EMBEDDING_STRATEGY as EmbeddingStrategy) || "TIERED",
    bgeThreshold: parseFloat(process.env.BGE_THRESHOLD || "0.72"),
    autoSummarizeInterval: parseInt(process.env.AUTO_SUMMARIZE_INTERVAL || "15", 10),
    miniLMDimensions: 384,
    bgeDimensions: 1024,
  },
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

MEMORY TOOLS:
- boomerang_memory_search: Search using configured strategy (Fast Reply or Archivist)
- boomerang_memory_add: Save to transient tier (MiniLM, fast/transient)
- boomerang_memory_save_long: Archive to permanent tier (BGE-Large, slow/permanent)
- boomerang_memory_search_tiered: Force Fast Reply mode (MiniLM first, BGE fallback)
- boomerang_memory_search_parallel: Force Archivist mode (both tiers, RRF merge)

FAILURE TO FOLLOW THESE STEPS IS A CRITICAL ERROR.
`;

export const BoomerangPlugin = async (ctx: PluginContext): Promise<any> => {
  const config = DEFAULT_CONFIG;
  try {
    ctx.client.app.log("Boomerang Protocol activated (lazy compaction + context isolation enabled)");
  } catch {
    // Logging not available
  }

  // Start super-memory MCP client
  let useBuiltIn = false;
  try {
    const { getMemoryService } = await import('../../src/memory-service.js');
    const memoryService = getMemoryService();
    await memoryService.initialize();
    boomerangMemory.setMemoryService(memoryService);
    useBuiltIn = true;
    ctx.client.app.log("Using built-in Super-Memory");
  } catch {
    // Fall back to MCP
    try {
      const mcpClient = await initializeMemoryClient();
      boomerangMemory.setMcpClient(mcpClient);
      setProjectSearchClient(mcpClient);
      ctx.client.app.log("Using MCP fallback");
    } catch (err) {
      console.error('❌ Failed to start super-memory MCP:', err);
    }
  }

  // Log bundled assets
  console.log(`📦 Loaded ${listAvailableAgents().length} agents`);
  console.log(`📦 Loaded ${listAvailableSkills().length} skills`);

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
- Memory Strategy: ${config.memoryTierConfig.strategy === "TIERED" ? "Fast Reply" : "Archivist"}
- Memory BGE Threshold: ${config.memoryTierConfig.bgeThreshold}
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
        description: "Search super-memory for relevant context using configured strategy",
        args: {
          query: tool.schema.string().describe("Search query"),
          project: tool.schema.string().optional().describe("Filter by project tag"),
          limit: tool.schema.number().optional().describe("Max results"),
        },
        async execute(args: { query: string; project?: string; limit?: number }) {
          const result = await boomerangMemory.searchMemory(args.query, args.limit || 5, args.project);
          if (!result.success) {
            return `Memory search failed: ${result.error}`;
          }
          if (!result.results || result.results.length === 0) {
            return "No relevant memories found.";
          }
          return `Strategy: ${result.strategy}, Tiers: ${result.tierSearched?.join(", ")}, Confidence: ${result.confidence}\n\n${result.results
            .map((r) => `- [${r.tier || "unknown"}] ${r.content}`)
            .join("\n")}`;
        },
      }),

      boomerang_memory_add: tool({
        description: "Save context to super-memory transient tier (MiniLM, fast/transient)",
        args: {
          content: tool.schema.string().describe("Content to save"),
          tags: tool.schema.string().optional().describe("Comma-separated tags"),
          project: tool.schema.string().optional().describe("Project tag"),
          metadata: tool.schema.string().optional().describe("JSON string of key-value metadata"),
        },
        async execute(args: { content: string; tags?: string; project?: string; metadata?: string }) {
          const tags = args.tags?.split(",").map((t) => t.trim());
          const metadata = args.metadata ? JSON.parse(args.metadata) : undefined;
          const result = await boomerangMemory.addMemory(args.content, tags, args.project, metadata);
          return result.success
            ? `Saved to transient memory (ID: ${result.id})`
            : `Failed to save: ${result.error}`;
        },
      }),

      boomerang_memory_save_long: tool({
        description: "High-fidelity archival of complex technical context using BGE-Large (1024-dim). Use for architectural decisions, verified successes, and session summaries.",
        args: {
          content: tool.schema.string().describe("High-value technical summary to archive"),
          project: tool.schema.string().describe("Project tag (e.g., 'sports-betting-v3', 'cloud-infra-proposal')"),
          tags: tool.schema.string().optional().describe("Comma-separated tags"),
          metadata: tool.schema.string().optional().describe("JSON string of key-value metadata"),
          force_high_precision: tool.schema.boolean().optional().describe("Force BGE-Large embedding (default: true)"),
        },
        async execute(args: { content: string; project: string; tags?: string; metadata?: string; force_high_precision?: boolean }) {
          const tags = args.tags?.split(",").map((t) => t.trim());
          const metadata = args.metadata ? JSON.parse(args.metadata) : undefined;
          const result = await boomerangMemory.addMemoryLong(args.content, args.project, tags, metadata, args.force_high_precision ?? true);
          return result.success
            ? `Archived to deep memory with BGE-Large [${result.embeddingModel}, ${result.dimensions}d] (ID: ${result.id})`
            : `Failed to archive: ${result.error}`;
        },
      }),

      boomerang_memory_search_tiered: tool({
        description: "Force Fast Reply mode: MiniLM first, BGE fallback if confidence is low. Use when you need speed but want high recall.",
        args: {
          query: tool.schema.string().describe("Search query"),
          project: tool.schema.string().optional().describe("Filter by project tag"),
          limit: tool.schema.number().optional().describe("Max results"),
        },
        async execute(args: { query: string; project?: string; limit?: number }) {
          const result = await boomerangMemory.searchMemory(args.query, args.limit || 5, args.project, "TIERED");
          if (!result.success) return `Search failed: ${result.error}`;
          if (!result.results || result.results.length === 0) return "No memories found.";
          return `Strategy: ${result.strategy}, Tiers: ${result.tierSearched?.join(", ")}, Confidence: ${result.confidence}\n\n${result.results.map((r) => `- [${r.tier}] ${r.content}`).join("\n")}`;
        },
      }),

      boomerang_memory_search_parallel: tool({
        description: "Force Archivist mode: query both MiniLM and BGE simultaneously, merge with RRF. Use for high-stakes architectural decisions.",
        args: {
          query: tool.schema.string().describe("Search query"),
          project: tool.schema.string().optional().describe("Filter by project tag"),
          limit: tool.schema.number().optional().describe("Max results"),
        },
        async execute(args: { query: string; project?: string; limit?: number }) {
          const result = await boomerangMemory.searchMemory(args.query, args.limit || 5, args.project, "PARALLEL");
          if (!result.success) return `Search failed: ${result.error}`;
          if (!result.results || result.results.length === 0) return "No memories found.";
          return `Strategy: ${result.strategy}, Tiers: ${result.tierSearched?.join(", ")}\n\n${result.results.map((r) => `- [${r.tier}] ${r.content}`).join("\n")}`;
        },
      }),

      boomerang_project_search: tool({
        description: "Search project files using semantic search (built-in indexer)",
        args: {
          query: tool.schema.string().describe("Search query for project files"),
          limit: tool.schema.number().optional().describe("Max results (default: 10)"),
        },
        async execute(args: { query: string; limit?: number }, context: { directory: string }) {
          // Ensure index manager is initialized for this project
          if (!isProjectIndexManagerInitialized() || !context.directory) {
            return "Project index not initialized. Start a session first.";
          }
          
          const result = await searchProjectFiles(args.query, args.limit || 10);
          if (!result.success) {
            return `Project search failed: ${result.error}`;
          }
          if (!result.results || result.results.length === 0) {
            return "No matching project files found.";
          }
          return `Found ${result.results.length} matching files:\n\n${formatProjectContextForInjection(result.results)}`;
        },
      }),

      boomerang_project_status: tool({
        description: "Get status of the built-in project indexer",
        args: {},
        async execute(_args: any, context: { directory: string }) {
          // Ensure index manager is initialized
          if (!isProjectIndexManagerInitialized() && context.directory) {
            try {
              await initializeProjectIndexManager(context.directory);
            } catch (err) {
              return `Failed to initialize: ${err}`;
            }
          }
          
          const status = getProjectIndexStatus();
          return `Project Index Status:
- Files Indexed: ${status.indexedFiles}
- Total Chunks: ${status.totalChunks}
- Status: ${status.status}
- Model Loaded: ${status.modelLoaded}
${status.error ? `- Error: ${status.error}` : ''}`;
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

      boomerang_workspace_add: tool({
        description: "Add a new project to the Boomerang workspace",
        args: {
          name: tool.schema.string().describe("Project name (alphanumeric, hyphens)"),
          path: tool.schema.string().describe("Absolute path to project root"),
        },
        async execute(args: { name: string; path: string }) {
          try {
            const workspace = getWorkspaceManager();
            await workspace.addProject(args.name, args.path);
            return `Project '${args.name}' added to workspace at ${args.path}`;
          } catch (err) {
            return `Failed to add project: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),

      boomerang_workspace_switch: tool({
        description: "Switch to a different project in the workspace",
        args: {
          name: tool.schema.string().describe("Project name to switch to"),
        },
        async execute(args: { name: string }) {
          try {
            const workspace = getWorkspaceManager();
            await workspace.switchProject(args.name);
            const project = workspace.getActiveProject();
            return `Switched to project '${args.name}'\nPath: ${project?.path}\nMemory: ${project?.memoryPath}\nIndex: ${project?.indexPath}`;
          } catch (err) {
            return `Failed to switch project: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),

      boomerang_workspace_list: tool({
        description: "List all projects in the Boomerang workspace",
        args: {},
        async execute() {
          try {
            const workspace = getWorkspaceManager();
            const status = workspace.getStatus();
            if (!status.loaded) {
              return "Workspace not loaded";
            }

            let output = `## Boomerang Workspace\n\n`;
            output += `**Active Project:** ${status.activeProject || 'none'}\n`;
            output += `**Total Projects:** ${status.projects.length}\n\n`;
            output += `| Project | Path | Status | Files | Chunks |\n`;
            output += `|---------|------|--------|-------|--------|\n`;

            for (const name of status.projects) {
              const ps = status.projectStatuses[name];
              if (ps) {
                output += `| ${name} | ${ps.path} | ${ps.status} | ${ps.indexedFiles} | ${ps.totalChunks} |\n`;
              }
            }

            return output;
          } catch (err) {
            return `Failed to list projects: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),

      boomerang_workspace_search_all: tool({
        description: "Search across all projects in the workspace",
        args: {
          query: tool.schema.string().describe("Search query"),
          limit: tool.schema.number().optional().describe("Max results per project (default: 5)"),
        },
        async execute(args: { query: string; limit?: number }) {
          try {
            const workspace = getWorkspaceManager();
            const results = await workspace.searchAllProjects(args.query, args.limit || 5);

            if (results.length === 0) {
              return "No results found across any project.";
            }

            let output = `## Cross-Project Search Results\n\n`;
            for (const projectResult of results) {
              output += `### ${projectResult.project} (${projectResult.count} results)\n`;
              for (const result of projectResult.results.slice(0, 3)) {
                const filePath = result.filePath || result.chunk?.filePath || 'unknown';
                output += `- ${filePath}\n`;
              }
              if (projectResult.results.length > 3) {
                output += `- ... and ${projectResult.results.length - 3} more\n`;
              }
              output += '\n';
            }

            return output;
          } catch (err) {
            return `Cross-project search failed: ${err instanceof Error ? err.message : String(err)}`;
          }
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
            const summary = generateSessionSummary(session);
            await boomerangMemory.addMemoryLong(summary, "boomerang-session", ["boomerang", "session", "compacted"]);
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

    cleanup: async () => {
      await boomerangMemory.shutdown();
    },
  };
};

export default BoomerangPlugin;
