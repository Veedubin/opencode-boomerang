import { parseTasksFromPrompt, buildDAG, createExecutionPlan, assignAgentsToTasks, } from "./task-parser.js";
import { executeParallelTasks, executeSequentialTasks, aggregateResults, } from "./task-executor.js";
import { boomerangMemory } from "./memory.js";
import { checkGitStatus, commitCheckpoint, commitWithMessage, generateCommitMessage, } from "./git.js";
import { runAllQualityGates, DEFAULT_QUALITY_GATES } from "./quality-gates.js";
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
        catch { }
        const gitStatus = { isDirty: false, files: [], branch: "", ahead: 0, behind: 0 };
        if (this.config.gitCheckBeforeWork) {
            const status = await checkGitStatus(this.$);
            Object.assign(gitStatus, status);
            if (status.isDirty) {
                await commitCheckpoint(this.$, "wip: pre-work checkpoint");
            }
        }
        const memoryContext = await this.fetchMemoryContext(prompt);
        const tasks = parseTasksFromPrompt(prompt);
        const tasksWithAgents = assignAgentsToTasks(tasks);
        const dag = buildDAG(tasksWithAgents);
        const executionPlan = createExecutionPlan(dag);
        const executionResults = await this.executePlan(executionPlan);
        const aggregated = aggregateResults(executionResults);
        let qualityPassed = true;
        let qualitySummary = "Skipped";
        const qualityResult = await runAllQualityGates(this.$, DEFAULT_QUALITY_GATES);
        qualityPassed = qualityResult.allPassed;
        qualitySummary = qualityResult.summary;
        let commitResult;
        if (this.config.gitCommitAfterWork && qualityPassed) {
            const commitMessage = generateCommitMessage(prompt);
            const result = await commitWithMessage(this.$, commitMessage);
            if (result.success && result.hash) {
                commitResult = { hash: result.hash, message: commitMessage };
            }
        }
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
            if (phase.type === "parallel") {
                phaseResult.results = await executeParallelTasks(this.ctx, phase.tasks.map((t) => ({
                    id: t.id,
                    description: t.description,
                    agent: t.agent,
                })), this.config.coderModel);
            }
            else {
                phaseResult.results = await executeSequentialTasks(this.ctx, phase.tasks.map((t) => ({
                    id: t.id,
                    description: t.description,
                    agent: t.agent,
                })), this.config.coderModel);
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
        summary += `**Git:** ${gitStatus.branch || "unknown"}`;
        if (gitStatus.isDirty)
            summary += " (dirty)";
        summary += "\n";
        if (commit) {
            summary += `**Commit:** ${commit.hash} - ${commit.message}\n`;
        }
        return summary;
    }
}
export function createBoomerangOrchestrator(ctx, config, shellRunner) {
    return new BoomerangOrchestrator(ctx, config, shellRunner);
}
