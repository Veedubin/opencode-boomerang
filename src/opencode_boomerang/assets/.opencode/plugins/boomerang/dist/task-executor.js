export const MODEL_ROUTING = {
    orchestrator: "kimi-for-coding/k2.5",
    architect: "openai/gpt-5.4",
    coder: "minimax/MiniMax-M2.7-highspeed",
    tester: "google/gemini-3-pro",
    linter: "minimax/MiniMax-M2.7",
    git: "minimax/MiniMax-M2.7",
};
export const AGENT_SYSTEM_PROMPTS = {
    orchestrator: `You are the Boomerang Orchestrator. Your role is to coordinate multi-agent task execution.
Coordinate with sub-agents, aggregate results, and ensure quality gates pass.
Always use the appropriate model for each task type.`,
    architect: `You are the Boomerang Architect. Your role is design decisions and architecture review.
Analyze code structure, identify patterns, and provide trade-off analysis.
Think deeply about long-term implications of design choices.`,
    coder: `You are the Boomerang Coder. Your role is fast, high-quality code implementation.
Write clean, efficient code following project conventions.
Use MiniMax M2.7 for fast code generation.`,
    tester: `You are the Boomerang Tester. Your role is comprehensive testing.
Write unit tests, integration tests, and verify functionality.
Ensure high test coverage and bug detection.`,
    linter: `You are the Boomerang Linter. Your role is code quality enforcement.
Run linters, formatters, and check code style.
Flag issues and auto-fix when possible.`,
    git: `You are the Boomerang Git Agent. Your role is version control management.
Handle commits, branches, merges, and git workflow.
Write meaningful commit messages.`,
};
export async function executeTaskInSession(ctx, task, model) {
    const agent = task.agent || "coder";
    const selectedModel = model || MODEL_ROUTING[agent] || MODEL_ROUTING.coder;
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agent] || AGENT_SYSTEM_PROMPTS.coder;
    try {
        const response = await ctx.client.session.prompt({
            path: { id: ctx.sessionId },
            body: {
                parts: [
                    { type: "text", text: systemPrompt },
                    { type: "text", text: `\n\nTask: ${task.description}` },
                ],
                noReply: false,
            },
        });
        return {
            taskId: task.id,
            success: true,
            output: typeof response === "string" ? response : JSON.stringify(response),
        };
    }
    catch (error) {
        return {
            taskId: task.id,
            success: false,
            output: "",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function executeParallelTasks(ctx, tasks, model) {
    const promises = tasks.map((task) => executeTaskInSession(ctx, task, model));
    return Promise.all(promises);
}
export async function executeSequentialTasks(ctx, tasks, model) {
    const results = [];
    for (const task of tasks) {
        const result = await executeTaskInSession(ctx, task, model);
        results.push(result);
        if (!result.success) {
            break;
        }
    }
    return results;
}
export function aggregateResults(results) {
    let totalTasks = 0;
    let successfulTasks = 0;
    let failedTasks = 0;
    for (const phase of results) {
        totalTasks += phase.results.length;
        for (const r of phase.results) {
            if (r.success) {
                successfulTasks++;
            }
            else {
                failedTasks++;
            }
        }
    }
    let summary = `## Execution Summary\n\n`;
    summary += `- **Total Tasks:** ${totalTasks}\n`;
    summary += `- **Successful:** ${successfulTasks}\n`;
    summary += `- **Failed:** ${failedTasks}\n\n`;
    for (const phase of results) {
        summary += `### Phase ${phase.phase} (${phase.type})\n`;
        summary += `- Status: ${phase.allSuccess ? "✅ All Passed" : "❌ Some Failed"}\n`;
        for (const r of phase.results) {
            summary += `  - ${r.taskId}: ${r.success ? "✅" : "❌"}`;
            if (r.error) {
                summary += ` (${r.error})`;
            }
            summary += `\n`;
        }
        summary += `\n`;
    }
    return {
        totalTasks,
        successfulTasks,
        failedTasks,
        allPassed: failedTasks === 0,
        summary,
    };
}
