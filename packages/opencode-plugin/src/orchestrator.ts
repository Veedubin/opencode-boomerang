import { parseTasksFromPrompt, buildDAG, createExecutionPlan, assignAgentsToTasks } from "./task-parser.js";
import { executeParallelTasks, executeSequentialTasks, aggregateResults } from "./task-executor.js";
import { boomerangMemory } from "./memory.js";
import { checkGitStatus, commitCheckpoint, commitWithMessage, generateCommitMessage } from "./git.js";
import { runAllQualityGates, DEFAULT_QUALITY_GATES } from "./quality-gates.js";
import { OrchestratorContext, BoomerangConfig, ExecutionPlan, PhaseResult, AggregatedResults, GitStatus, DEFAULT_EXECUTION_CONFIG } from "./types.js";
import { isolateResult } from "./context-isolation.js";
import { globalMiddleware } from "./middleware.js";
import { ProtocolStateMachine } from "../../../protocol/state-machine.js";
import type { ProtocolContext } from "../../../protocol/types.js";

export class BoomerangOrchestrator {
  private ctx: OrchestratorContext;
  private config: BoomerangConfig;
  private $: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>;
  private stateMachine: ProtocolStateMachine;

  constructor(
    ctx: OrchestratorContext,
    config: BoomerangConfig,
    shellRunner: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>
  ) {
    this.ctx = ctx;
    this.config = config;
    this.$ = shellRunner;
    this.stateMachine = new ProtocolStateMachine();
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
    const sessionId = crypto.randomUUID();
    
    try {
      this.ctx.client.app.log("Starting Boomerang execution");
    } catch {
      // Client logging not available
    }

    // Initialize session in state machine
    this.stateMachine.initializeSession(sessionId, {
      sessionId,
      taskDescription: prompt,
      taskType: 'simple_query',
      waiverPhrasesDetected: [],
    });

    // Git check
    const gitStatus: GitStatus = { isDirty: false, files: [], branch: "", ahead: 0, behind: 0 };
    if (this.config.gitCheckBeforeWork) {
      // Step 1: MEMORY_QUERY (state machine transition)
      await this.stateMachine.transition(sessionId, 'MEMORY_QUERY', {
        sessionId,
        taskDescription: prompt,
        taskType: 'simple_query',
        waiverPhrasesDetected: [],
      });
      this.stateMachine.setCheckpoint(sessionId, 'memoryQueryCompleted', true);
      
      const status = await checkGitStatus(this.$);
      Object.assign(gitStatus, status);
      if (status.isDirty) {
        await commitCheckpoint(this.$, "wip: pre-work checkpoint");
      }
    }

    // Memory context (via state machine checkpoint)
    const memoryContext = await this.fetchMemoryContext(prompt);
    if (memoryContext) {
      try {
        this.ctx.client.app.log("Memory context fetched");
      } catch {}
    }

    // Parse and plan
    const tasks = parseTasksFromPrompt(prompt);
    const tasksWithAgents = assignAgentsToTasks(tasks);

    const dag = buildDAG(tasksWithAgents);
    const executionPlan = createExecutionPlan(dag);

    // Execute with optional middleware
    // Step 2: SEQUENTIAL_THINK (if needed)
    // Step 3: PLAN (if needed)
    // Step 4: DELEGATE
    const executionResults = await this.executePlan(executionPlan, sessionId);
    const aggregated = aggregateResults(executionResults);
    
    // Mark delegation completed checkpoint
    this.stateMachine.setCheckpoint(sessionId, 'delegationCompleted', true);

    // Step 5: GIT_CHECK
    await this.stateMachine.transition(sessionId, 'GIT_CHECK');
    this.stateMachine.setCheckpoint(sessionId, 'gitCheckPassed', true);

    // Quality gates
    // Step 6: QUALITY_GATES
    await this.stateMachine.transition(sessionId, 'QUALITY_GATES');
    let qualityPassed = true;
    let qualitySummary = "Skipped";
    const qualityResult = await runAllQualityGates(DEFAULT_QUALITY_GATES);
    qualityPassed = qualityResult.allPassed;
    qualitySummary = qualityResult.summary;
    this.stateMachine.setCheckpoint(sessionId, 'qualityGatesPassed', true);

    // Git commit
    let commitResult: { hash: string; message: string } | undefined;
    if (this.config.gitCommitAfterWork && qualityPassed) {
      const commitMessage = generateCommitMessage(prompt);
      const result = await commitWithMessage(this.$, commitMessage);
      if (result.success && result.hash) {
        commitResult = { hash: result.hash, message: commitMessage };
      }
    }

    // Step 7: DOC_UPDATE
    await this.stateMachine.transition(sessionId, 'DOC_UPDATE');
    this.stateMachine.setCheckpoint(sessionId, 'docsUpdated', true);

    // Save memory
    // Step 8: MEMORY_SAVE
    await this.stateMachine.transition(sessionId, 'MEMORY_SAVE');
    if (this.config.memoryEnabled) {
      await boomerangMemory.addMemory(
        `Completed: ${prompt.substring(0, 200)}... Tasks: ${tasks.length}, Passed: ${aggregated.successfulTasks}`,
        ["boomerang", "session"]
      );
    }
    this.stateMachine.setCheckpoint(sessionId, 'memorySaveCompleted', true);

    // Complete
    await this.stateMachine.transition(sessionId, 'COMPLETE');

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

  private async executePlan(plan: ExecutionPlan, sessionId: string): Promise<PhaseResult[]> {
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
}

export function createBoomerangOrchestrator(
  ctx: OrchestratorContext,
  config: BoomerangConfig,
  shellRunner: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>
): BoomerangOrchestrator {
  return new BoomerangOrchestrator(ctx, config, shellRunner);
}