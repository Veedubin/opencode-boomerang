import { getSessionState, markDirty } from "./session-state.js";
const AGENTS_TEMPLATE = `# Boomerang Agent State

## Session: {sessionId}
Last Updated: {lastUpdated}

## Agent Activity
{agentActivity}

## Key Decisions
{decisions}

## Learnings
{learnings}
`;
export async function updateAGENTSMD(sessionId, session) {
    const agentGroups = new Map();
    for (const decision of session.agentDecisions) {
        if (!agentGroups.has(decision.agent)) {
            agentGroups.set(decision.agent, []);
        }
        agentGroups.get(decision.agent).push(decision);
    }
    const agentActivityLines = [];
    for (const [agent, decisions] of agentGroups) {
        agentActivityLines.push(`### ${agent}`);
        agentActivityLines.push(`Decisions made: ${decisions.length}`);
        const recent = decisions.slice(-3);
        for (const d of recent) {
            agentActivityLines.push(`- ${d.timestamp}: ${d.summary}`);
        }
        agentActivityLines.push("");
    }
    const agentActivity = agentActivityLines.length > 0 ? agentActivityLines.join("\n") : "  (no agent activity)";
    const decisionsLines = session.agentDecisions.map((d) => `| ${d.agent} | ${d.timestamp} | ${d.summary} |${d.reasoning ? ` ${d.reasoning} |` : " - |"}`);
    const decisions = decisionsLines.length > 0
        ? `| Agent | Time | Summary | Reasoning |\n|------|------|---------|----------|\n${decisionsLines.join("\n")}`
        : "  (no decisions recorded)";
    const learningsLines = [];
    const agentSet = new Set();
    for (const task of session.completedTasks) {
        if (task.agent)
            agentSet.add(task.agent);
    }
    for (const task of session.pendingTasks) {
        if (task.agent)
            agentSet.add(task.agent);
    }
    for (const agent of agentSet) {
        learningsLines.push(`### ${agent}`);
        learningsLines.push(`- Active in this session`);
    }
    const learnings = learningsLines.length > 0 ? learningsLines.join("\n") : "  (no specific learnings)";
    const content = AGENTS_TEMPLATE
        .replace("{sessionId}", sessionId)
        .replace("{lastUpdated}", new Date().toISOString())
        .replace("{agentActivity}", agentActivity)
        .replace("{decisions}", decisions)
        .replace("{learnings}", learnings);
    try {
        const { writeFile } = await import("fs/promises");
        const path = `${process.cwd()}/AGENTS.md`;
        await writeFile(path, content, "utf-8");
    }
    catch {
        // Ignore errors - AGENTS.md update is best-effort
    }
}
export function recordDecisionInSession(sessionId, agent, summary, reasoning) {
    const session = getSessionState(sessionId);
    if (!session)
        return;
    session.agentDecisions.push({
        agent,
        summary,
        reasoning,
        timestamp: new Date().toISOString(),
    });
    markDirty(sessionId);
    updateAGENTSMD(sessionId, session).catch(() => { });
}
