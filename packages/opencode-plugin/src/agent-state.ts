import { getOrCreateSession, markDirty } from "./session-state.js";
import * as fs from "fs";
import * as path from "path";

export function updateAGENTSMD(projectDir: string, agents: Array<{ name: string; role: string }>): void {
  const agentsPath = path.join(projectDir, "AGENTS.md");
  let content = "# Boomerang Agent Roster\n\n";
  content += "| Agent | Role |\n";
  content += "|-------|------|\n";
  for (const agent of agents) {
    content += `| ${agent.name} | ${agent.role} |\n`;
  }
  fs.writeFileSync(agentsPath, content, "utf-8");
}

export function recordDecisionInSession(
  sessionId: string,
  agent: string,
  summary: string,
  reasoning?: string
): void {
  const session = getOrCreateSession(sessionId);
  session.agentDecisions.push({
    agent,
    summary,
    reasoning,
    timestamp: new Date().toISOString(),
  });
  markDirty(sessionId);
}