import {
  parseTasksFromPrompt,
  buildDAG,
  createExecutionPlan,
  assignAgentsToTasks,
} from "./task-parser.js";
import {
  executeParallelTasks,
  executeSequentialTasks,
  aggregateResults,
} from "./task-executor.js";
import { boomerangMemory } from "./memory.js";
import {
  checkGitStatus,
  commitCheckpoint,
  commitWithMessage,
  generateCommitMessage,
} from "./git.js";
import { runAllQualityGates, DEFAULT_QUALITY_GATES } from "./quality-gates.js";
import {
  OrchestratorContext,
  BoomerangConfig,
  ExecutionPlan,
  PhaseResult,
  AggregatedResults,
  GitStatus,
  DEFAULT_EXECUTION_CONFIG,
} from "./types.js";
import { isolateResult } from "./context-isolation.js";
import { globalMiddleware } from "./middleware.js";
import { MetricsCollector } from "../../../src/opencode_boomerang/metrics/collector.js";
import { TaskType } from "../../../src/opencode_boomerang/metrics/types.js";

export class BoomerangOrchestrator {
  private ctx: OrchestratorContext;
  private config: BoomerangConfig;
  private $: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>;

  constructor(
    ctx: OrchestratorContext,
    config: BoomerangConfig,
    shellRunner: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>
  ) {
    this.ctx = ctx;
    this.config = config;
    this.$ = shellRunner;
  }

  async run(prompt: string): Promise<{
    success: boolean;
    tasks: any[];
    dag: any;
    executionPlan: ExecutionPlan;
    executionResults: PhaseResult[];
    qualityGateResults: { allPassed: boolean; summary: string };
    gitCommit?: { hash: string; message: string };
    memorySaved: boolean;
    summary: string;
  }> {
    try {
      this.ctx.client.app.log("Starting Boomerang execution");
    } catch {
      // Client logging not available
    }

    // Git check
    const gitStatus: GitStatus = { isDirty: false, files: [], branch: "", ahead: 0, behind: 0 };
    if (this.config.gitCheckBeforeWork) {
      const status = await checkGitStatus(this.$);
      Object.assign(gitStatus, status);
      if (status.isDirty) {
        await commitCheckpoint(this.$, "wip: pre-work checkpoint");
      }
    }

    // Memory context
    const memoryContext = await this.fetchMemoryContext(prompt);
    if (memoryContext) {
      try {
        this.ctx.client.app.log("Memory context fetched");
      } catch {}
    }

    // Parse and plan
    const tasks = parseTasksFromPrompt(prompt);
    let tasksWithAgents = assignAgentsToTasks(tasks);

    // Apply routing optimization based on historical performance
    tasksWithAgents = await this.optimizeRouting(tasksWithAgents);

    const dag = buildDAG(tasksWithAgents);
    const executionPlan = createExecutionPlan(dag);

    // Execute with optional middleware
    const executionResults = await this.executePlan(executionPlan);
    const aggregated = aggregateResults(executionResults);

    // Quality gates
    let qualityPassed = true;
    let qualitySummary = "Skipped";
    const qualityResult = await runAllQualityGates(DEFAULT_QUALITY_GATES);
    qualityPassed = qualityResult.allPassed;
    qualitySummary = qualityResult.summary;

    // Git commit
    let commitResult: { hash: string; message: string } | undefined;
    if (this.config.gitCommitAfterWork && qualityPassed) {
      const commitMessage = generateCommitMessage(prompt);
      const result = await commitWithMessage(this.$, commitMessage);
      if (result.success && result.hash) {
        commitResult = { hash: result.hash, message: commitMessage };
      }
    }

    // Save memory
    if (this.config.memoryEnabled) {
      await boomerangMemory.addMemory(
        `Completed: ${prompt.substring(0, 200)}... Tasks: ${tasks.length}, Passed: ${aggregated.successfulTasks}`,
        ["boomerang", "session"]
      );
    }

    return {
      success: aggregated.allPassed && qualityPassed,
      tasks: tasksWithAgents,
      dag,
      executionPlan,
      executionResults,
      qualityGateResults: { allPassed: qualityPassed, summary: qualitySummary },
      gitCommit: commitResult,
      memorySaved: this.config.memoryEnabled,
      summary: this.formatSummary(aggregated, qualityPassed, commitResult, gitStatus),
    };
  }

  private async fetchMemoryContext(prompt: string): Promise<string> {
    if (!this.config.memoryEnabled) return "";
    const searchResult = await boomerangMemory.searchMemory(prompt);
    if (searchResult.success && searchResult.results) {
      return boomerangMemory.formatContextForInjection(searchResult.results);
    }
    return "";
  }

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

      // Wrap execution with middleware if enabled
      if (this.config.middlewareEnabled) {
        phaseResult.results = await globalMiddleware.execute(
          "before_agent",
          { phase, config: this.config },
          async () => {
            return phase.type === "parallel"
              ? await executeParallelTasks(
                  this.ctx,
                  phase.tasks.map((t) => ({
                    id: t.id,
                    description: t.description,
                    agent: t.agent,
                    status: t.status,
                    dependencies: t.dependencies,
                  })),
                  this.config.coderModel,
                  executionConfig
                )
              : await executeSequentialTasks(
                  this.ctx,
                  phase.tasks.map((t) => ({
                    id: t.id,
                    description: t.description,
                    agent: t.agent,
                    status: t.status,
                    dependencies: t.dependencies,
                  })),
                  this.config.coderModel,
                  executionConfig
                );
          }
        );
      } else {
        phaseResult.results =
          phase.type === "parallel"
            ? await executeParallelTasks(
                this.ctx,
                phase.tasks.map((t) => ({
                  id: t.id,
                  description: t.description,
                  agent: t.agent,
                  status: t.status,
                  dependencies: t.dependencies,
                })),
                this.config.coderModel,
                executionConfig
              )
            : await executeSequentialTasks(
                this.ctx,
                phase.tasks.map((t) => ({
                  id: t.id,
                  description: t.description,
                  agent: t.agent,
                  status: t.status,
                  dependencies: t.dependencies,
                })),
                this.config.coderModel,
                executionConfig
              );
      }

      // Apply context isolation to results
      if (this.config.contextIsolationEnabled) {
        phaseResult.results = phaseResult.results.map((result) => {
          if (result.output && result.output.length > 100) {
            const isolated = isolateResult(
              result.output,
              "task",
              result.taskId,
              (raw) => raw.substring(0, 500) + (raw.length > 500 ? "..." : "")
            );
            return {
              ...result,
              output: isolated.summary,
            };
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

  private formatSummary(
    aggregated: AggregatedResults,
    qualityPassed: boolean,
    commit?: { hash: string; message: string },
    gitStatus?: GitStatus
  ): string {
    let summary = "## Boomerang Execution Summary\n\n";
    summary += `**Status:** ${aggregated.failedTasks === 0 && qualityPassed ? "✅ Success" : "⚠️ Partial"}\n\n`;
    summary += `**Tasks:** ${aggregated.successfulTasks}/${aggregated.totalTasks} completed\n`;
    summary += `**Quality Gates:** ${qualityPassed ? "✅ Passed" : "❌ Failed"}\n`;
    summary += `**Git:** ${gitStatus?.branch || "unknown"}`;
    if (gitStatus?.isDirty) summary += " (dirty)";
    summary += "\n";
    if (commit) {
      summary += `**Commit:** ${commit.hash} - ${commit.message}\n`;
    }
    if (this.config.contextIsolationEnabled) {
      summary += "\n*Context isolation enabled — large outputs evicted to files*\n";
    }
    return summary;
  }

  /**
   * Optimize agent routing based on historical performance metrics.
   *
   * For each task, checks if there's a better-performing agent for the
   * inferred task type and overrides the default assignment if confidence
   * is high enough.
   */
  private async optimizeRouting(
    tasks: typeof tasksWithAgents
  ): Promise<typeof tasksWithAgents> {
    const metricsCollector = MetricsCollector.getInstance();
    if (!metricsCollector.isInitialized()) {
      return tasks;
    }

    const optimized = [];
    for (const task of tasks) {
      try {
        // Infer task type from description
        const taskType = this.inferTaskType(task.description, task.agent);

        // Get routing recommendation
        const recommendation = await metricsCollector.getRoutingRecommendation(taskType);

        // Only override if confidence is high enough and it's a different agent
        if (
          recommendation.confidence >= 0.5 &&
          recommendation.agent !== task.agent &&
          recommendation.dataPoints >= 3
        ) {
          try {
            this.ctx.client.app.log(
              `Routing optimization: ${task.agent} → ${recommendation.agent} for task "${task.description.substring(0, 50)}..." (${recommendation.reasoning})`
            );
          } catch {}
          optimized.push({ ...task, agent: recommendation.agent });
        } else {
          optimized.push(task);
        }
      } catch {
        // If routing fails, keep original assignment
        optimized.push(task);
      }
    }

    return optimized;
  }

  /**
   * Infer task type from description and agent.
   */
  private inferTaskType(description: string, agent: string): TaskType {
    const lowerDesc = description.toLowerCase();

    switch (agent) {
      case "coder":
        if (lowerDesc.includes("fix") || lowerDesc.includes("bug")) return "code-modification";
        if (lowerDesc.includes("test")) return "testing";
        return "code-generation";
      case "architect":
        return "architecture-design";
      case "tester":
        return "testing";
      case "linter":
        return "linting";
      case "git":
        return "git-operations";
      case "explorer":
        return "code-exploration";
      case "writer":
        return "documentation";
      case "scraper":
        return lowerDesc.includes("research") ? "web-research" : "web-scraping";
      default:
        return "unknown";
    }
  }
}

export function createBoomerangOrchestrator(
  ctx: OrchestratorContext,
  config: BoomerangConfig,
  shellRunner: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>
): BoomerangOrchestrator {
  return new BoomerangOrchestrator(ctx, config, shellRunner);
}
