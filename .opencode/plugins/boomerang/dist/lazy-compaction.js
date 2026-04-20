import { getSessionState, getOrCreateSession } from "./session-state.js";
import { boomerangMemory } from "./memory.js";
import { updateTASKSMD } from "./task-state.js";
import { updateAGENTSMD } from "./agent-state.js";
export async function compactSessionIfNeeded(sessionId, client) {
    const session = getSessionState(sessionId);
    if (!session)
        return null;
    const taskCount = session.completedTasks.length + session.pendingTasks.length;
    const decisionCount = session.agentDecisions.length;
    if (taskCount < 5 && decisionCount < 3) {
        return null;
    }
    return compactSession(sessionId, client);
}
export async function compactSession(sessionId, client) {
    const session = getOrCreateSession(sessionId);
    const projectDir = process.cwd();
    updateTASKSMD(sessionId, projectDir);
    updateAGENTSMD(projectDir, [
        { name: "orchestrator", role: "Main coordinator" },
        { name: "coder", role: "Code generation" },
        { name: "architect", role: "Architecture" },
    ]);
    const summary = buildCompactedContext(session);
    if (client?.app?.log) {
        client.app.log(`Session ${sessionId} compacted`);
    }
    await boomerangMemory.addMemory(summary, ["boomerang", "compacted"]);
    return summary;
}
export function buildCompactedContext(session) {
    let context = "## Compacted Session Context\n\n";
    context += `### Completed Tasks (${session.completedTasks.length})\n`;
    for (const task of session.completedTasks.slice(-5)) {
        context += `- ${task.description}\n`;
    }
    context += `\n### Key Decisions (${session.agentDecisions.length})\n`;
    for (const decision of session.agentDecisions.slice(-3)) {
        context += `- ${decision.agent}: ${decision.summary}\n`;
    }
    return context;
}
export function injectContext(context) {
    return `\n\n[COMPACTED CONTEXT]\n${context}\n`;
}
//# sourceMappingURL=lazy-compaction.js.map