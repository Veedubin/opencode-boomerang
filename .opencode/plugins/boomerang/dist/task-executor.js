export const MODEL_ROUTING = {
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
export const AGENT_SYSTEM_PROMPTS = {
    coder: "You are a fast code generation specialist. Write clean, efficient code.",
    architect: "You are a software architect. Make informed design decisions.",
    tester: "You are a testing specialist. Write comprehensive tests.",
    linter: "You are a quality enforcer. Ensure code meets standards.",
    git: "You are a git specialist. Handle version control operations.",
    explorer: "You are a codebase explorer. Find files and patterns.",
    writer: "You are a documentation specialist. Write clear docs.",
    scraper: "You are a research specialist. Gather and synthesize information.",
};
export async function executeTaskInSession(ctx, task, _model) {
    const startTime = Date.now();
    try {
        const systemPrompt = AGENT_SYSTEM_PROMPTS[task.agent] || "You are a helpful assistant.";
        const result = await ctx.client.session.prompt({
            path: { id: ctx.sessionId },
            body: {
                parts: [{
                        type: "text",
                        text: `[${task.agent.toUpperCase()}] ${systemPrompt}\n\nTask: ${task.description}`,
                    }],
            },
        });
        return {
            taskId: task.id,
            success: true,
            output: result?.content || "Completed",
            executionTime: Date.now() - startTime,
        };
    }
    catch (error) {
        return {
            taskId: task.id,
            success: false,
            output: "",
            error: error instanceof Error ? error.message : String(error),
            executionTime: Date.now() - startTime,
        };
    }
}
export async function executeParallelTasks(ctx, tasks, defaultModel) {
    const promises = tasks.map((task) => executeTaskInSession(ctx, task, MODEL_ROUTING[task.agent] || defaultModel));
    return Promise.all(promises);
}
export async function executeSequentialTasks(ctx, tasks, defaultModel) {
    const results = [];
    for (const task of tasks) {
        const result = await executeTaskInSession(ctx, task, MODEL_ROUTING[task.agent] || defaultModel);
        results.push(result);
        if (!result.success) {
            break;
        }
    }
    return results;
}
export function aggregateResults(phaseResults) {
    let total = 0;
    let successful = 0;
    let failed = 0;
    for (const phase of phaseResults) {
        for (const result of phase.results) {
            total++;
            if (result.success) {
                successful++;
            }
            else {
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
//# sourceMappingURL=task-executor.js.map