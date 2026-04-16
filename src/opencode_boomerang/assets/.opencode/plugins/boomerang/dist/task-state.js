import { getSessionState, markDirty } from "./session-state.js";
const TASKS_TEMPLATE = `# Boomerang Session Tasks

## Session: {sessionId}
Last Updated: {lastUpdated}

## Completed Tasks
{completedTasks}

## Pending Tasks
{pendingTasks}

## Agent Decisions
{agentDecisions}

## Session Summary
{summary}
`;
function formatTask(task) {
    let formatted = `- **${task.id}**: ${task.description}`;
    formatted += ` (agent: ${task.agent || "unknown"})`;
    if (task.status)
        formatted += ` [${task.status}]`;
    return formatted;
}
export async function updateTASKSMD(sessionId, session) {
    const completedSection = session.completedTasks.length > 0
        ? session.completedTasks.map(t => `  ${formatTask(t)}`).join("\n")
        : "  (none)";
    const pendingSection = session.pendingTasks.length > 0
        ? session.pendingTasks.map(t => `  ${formatTask(t)}`).join("\n")
        : "  (none)";
    const decisionsSection = session.agentDecisions.length > 0
        ? session.agentDecisions.map(d => `  - [${d.agent}] ${d.timestamp}: ${d.summary}`).join("\n")
        : "  (none)";
    const completedCount = session.completedTasks.length;
    const totalCount = completedCount + session.pendingTasks.length;
    const summary = totalCount > 0
        ? `Progress: ${completedCount}/${totalCount} tasks completed`
        : "No tasks tracked";
    const content = TASKS_TEMPLATE
        .replace("{sessionId}", sessionId)
        .replace("{lastUpdated}", new Date().toISOString())
        .replace("{completedTasks}", completedSection)
        .replace("{pendingTasks}", pendingSection)
        .replace("{agentDecisions}", decisionsSection)
        .replace("{summary}", summary);
    try {
        const { writeFile } = await import("fs/promises");
        const path = `${process.cwd()}/TASKS.md`;
        await writeFile(path, content, "utf-8");
    }
    catch {
        // Ignore errors - TASKS.md update is best-effort
    }
}
export function updateTaskInSession(sessionId, task) {
    const session = getSessionState(sessionId);
    if (!session)
        return;
    const existingPendingIdx = session.pendingTasks.findIndex((t) => t.id === task.id);
    if (existingPendingIdx > -1) {
        session.pendingTasks.splice(existingPendingIdx, 1);
    }
    const existingCompletedIdx = session.completedTasks.findIndex((t) => t.id === task.id);
    if (existingCompletedIdx > -1) {
        session.completedTasks.splice(existingCompletedIdx, 1);
    }
    if (task.status === "completed" || task.status === "failed") {
        session.completedTasks.push(task);
    }
    else {
        session.pendingTasks.push(task);
    }
    markDirty(sessionId);
    updateTASKSMD(sessionId, session).catch(() => { });
}
