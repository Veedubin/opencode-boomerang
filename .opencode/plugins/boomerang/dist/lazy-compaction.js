import { getSessionState, clearDirty, getOrCreateSession } from "./session-state.js";
import { updateTASKSMD } from "./task-state.js";
import { updateAGENTSMD } from "./agent-state.js";
import { boomerangMemory } from "./memory.js";
const DEFAULT_CONFIG = {
    enabled: true,
    memoryOffloadEnabled: true,
    taslsMdUpdateEnabled: true,
    agentsMdUpdateEnabled: true,
};
export async function compactSessionIfNeeded(sessionId, client, config = DEFAULT_CONFIG) {
    const session = getSessionState(sessionId);
    if (!session || !session.dirty) {
        return false;
    }
    await compactSession(sessionId, client, config);
    return true;
}
export async function compactSession(sessionId, client, config = DEFAULT_CONFIG) {
    const session = getOrCreateSession(sessionId);
    if (config.taslsMdUpdateEnabled) {
        await updateTASKSMD(sessionId, session);
    }
    if (config.agentsMdUpdateEnabled) {
        await updateAGENTSMD(sessionId, session);
    }
    if (config.memoryOffloadEnabled) {
        await offloadToSuperMemory(session);
    }
    const context = buildCompactedContext(session);
    clearDirty(sessionId);
    return context;
}
async function offloadToSuperMemory(session) {
    const completedSummaries = session.completedTasks
        .slice(-5)
        .map((t) => `${t.id}: ${t.description}`)
        .join("; ");
    const pendingSummaries = session.pendingTasks
        .map((t) => `${t.id}: ${t.description}`)
        .join("; ");
    const decisionsSummary = session.agentDecisions
        .slice(-5)
        .map((d) => `[${d.agent}] ${d.summary}`)
        .join("; ");
    const memoryContent = [
        `Session: ${session.sessionId}`,
        `Completed: ${completedSummaries || "none"}`,
        `Pending: ${pendingSummaries || "none"}`,
        `Decisions: ${decisionsSummary || "none"}`,
    ].join(" | ");
    await boomerangMemory.addMemory(memoryContent, [
        "boomerang-session",
        session.sessionId,
        "compacted",
    ]);
}
function buildCompactedContext(session) {
    let context = "## Boomerang Session Context\n\n";
    context += `Session: ${session.sessionId}\n`;
    context += `Last active: ${new Date(session.lastUsedAt).toISOString()}\n\n`;
    if (session.completedTasks.length > 0) {
        context += "### Completed Work\n";
        for (const task of session.completedTasks.slice(-5)) {
            context += `- ${task.description}`;
            if (task.agent)
                context += ` (${task.agent})`;
            context += "\n";
        }
        context += "\n";
    }
    if (session.pendingTasks.length > 0) {
        context += "### Pending Tasks\n";
        for (const task of session.pendingTasks) {
            context += `- ${task.description}`;
            if (task.agent)
                context += ` (${task.agent})`;
            context += "\n";
        }
        context += "\n";
    }
    if (session.agentDecisions.length > 0) {
        context += "### Key Decisions\n";
        for (const decision of session.agentDecisions.slice(-3)) {
            context += `- [${decision.agent}] ${decision.summary}\n`;
        }
        context += "\n";
    }
    return context;
}
export async function injectContext(sessionId, context, client) {
    try {
        await client.session.prompt({
            path: { id: sessionId },
            body: {
                parts: [{ type: "text", text: context }],
                noReply: true,
            },
        });
    }
    catch {
        // Injection failure is non-fatal
    }
}
