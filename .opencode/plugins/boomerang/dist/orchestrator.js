import { parseTasksFromPrompt, buildDAG, createExecutionPlan, assignAgentsToTasks, } from "./task-parser.js";
import { executeParallelTasks, executeSequentialTasks, aggregateResults, } from "./task-executor.js";
import { boomerangMemory } from "./memory.js";
import { checkGitStatus, commitCheckpoint, commitWithMessage, generateCommitMessage, } from "./git.js";
import { runAllQualityGates, DEFAULT_QUALITY_GATES } from "./quality-gates.js";
import { isolateResult } from "./context-isolation.js";
import { globalMiddleware } from "./middleware.js";
export class BoomerangOrchestrator {
    ctx;
    config;
    $;
    constructor(ctx, config, shellRunner) {
        this.ctx = ctx;
        this.config = config;
        this.$ = shellRunner;
    }
    async run(prompt) {
        try {
            this.ctx.client.app.log("Starting Boomerang execution");
        }
        catch {
            // Client logging not available
        }
        // Git check
        const gitStatus = { isDirty: false, files: [], branch: "", ahead: 0, behind: 0 };
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
            }
            catch { }
        }
        // Parse and plan
        const tasks = parseTasksFromPrompt(prompt);
        const tasksWithAgents = assignAgentsToTasks(tasks);
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
        let commitResult;
        if (this.config.gitCommitAfterWork && qualityPassed) {
            const commitMessage = generateCommitMessage(prompt);
            const result = await commitWithMessage(this.$, commitMessage);
            if (result.success && result.hash) {
                commitResult = { hash: result.hash, message: commitMessage };
            }
        }
        // Save memory
        if (this.config.memoryEnabled) {
            await boomerangMemory.addMemory(`Completed: ${prompt.substring(0, 200)}... Tasks: ${tasks.length}, Passed: ${aggregated.successfulTasks}`, ["boomerang", "session"]);
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
    async fetchMemoryContext(prompt) {
        if (!this.config.memoryEnabled)
            return "";
        const searchResult = await boomerangMemory.searchMemory(prompt);
        if (searchResult.success && searchResult.results) {
            return boomerangMemory.formatContextForInjection(searchResult.results);
        }
        return "";
    }
    async executePlan(plan) {
        const results = [];
        for (const phase of plan.executionOrder) {
            const phaseResult = {
                phase: phase.phase,
                type: phase.type,
                results: [],
                allSuccess: false,
            };
            // Wrap execution with middleware if enabled
            if (this.config.middlewareEnabled) {
                phaseResult.results = await globalMiddleware.execute("before_agent", { phase, config: this.config }, async () => {
                    return phase.type === "parallel"
                        ? await executeParallelTasks(this.ctx, phase.tasks.map((t) => ({
                            id: t.id,
                            description: t.description,
                            agent: t.agent,
                            status: t.status,
                            dependencies: t.dependencies,
                        })), this.config.coderModel)
                        : await executeSequentialTasks(this.ctx, phase.tasks.map((t) => ({
                            id: t.id,
                            description: t.description,
                            agent: t.agent,
                            status: t.status,
                            dependencies: t.dependencies,
                        })), this.config.coderModel);
                });
            }
            else {
                phaseResult.results =
                    phase.type === "parallel"
                        ? await executeParallelTasks(this.ctx, phase.tasks.map((t) => ({
                            id: t.id,
                            description: t.description,
                            agent: t.agent,
                            status: t.status,
                            dependencies: t.dependencies,
                        })), this.config.coderModel)
                        : await executeSequentialTasks(this.ctx, phase.tasks.map((t) => ({
                            id: t.id,
                            description: t.description,
                            agent: t.agent,
                            status: t.status,
                            dependencies: t.dependencies,
                        })), this.config.coderModel);
            }
            // Apply context isolation to results
            if (this.config.contextIsolationEnabled) {
                phaseResult.results = phaseResult.results.map((result) => {
                    if (result.output && result.output.length > 100) {
                        const isolated = isolateResult(result.output, "task", result.taskId, (raw) => raw.substring(0, 500) + (raw.length > 500 ? "..." : ""));
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
    formatSummary(aggregated, qualityPassed, commit, gitStatus) {
        let summary = "## Boomerang Execution Summary\n\n";
        summary += `**Status:** ${aggregated.failedTasks === 0 && qualityPassed ? "✅ Success" : "⚠️ Partial"}\n\n`;
        summary += `**Tasks:** ${aggregated.successfulTasks}/${aggregated.totalTasks} completed\n`;
        summary += `**Quality Gates:** ${qualityPassed ? "✅ Passed" : "❌ Failed"}\n`;
        summary += `**Git:** ${gitStatus?.branch || "unknown"}`;
        if (gitStatus?.isDirty)
            summary += " (dirty)";
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
export function createBoomerangOrchestrator(ctx, config, shellRunner) {
    return new BoomerangOrchestrator(ctx, config, shellRunner);
}
//# sourceMappingURL=orchestrator.js.map