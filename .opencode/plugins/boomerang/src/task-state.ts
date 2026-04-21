import { getOrCreateSession, markDirty } from "./session-state.js";
import { Task } from "./types.js";
import * as fs from "fs";
import * as path from "path";

export function updateTASKSMD(sessionId: string, projectDir: string): void {
  const session = getOrCreateSession(sessionId);
  const tasksPath = path.join(projectDir, "TASKS.md");
  let content = "# Boomerang Tasks\n\n";
  content += "## Completed\n\n";
  for (const task of session.completedTasks) {
    content += `- [x] ${task.description}\n`;
  }
  content += "\n## Pending\n\n";
  for (const task of session.pendingTasks) {
    content += `- [ ] ${task.description}\n`;
  }
  content += "\n## Decisions\n\n";
  for (const decision of session.agentDecisions) {
    content += `- **${decision.agent}**: ${decision.summary}\n`;
  }
  fs.writeFileSync(tasksPath, content, "utf-8");
}

export function updateTaskInSession(sessionId: string, task: Task): void {
  const session = getOrCreateSession(sessionId);
  const existingIndex = session.pendingTasks.findIndex((t) => t.id === task.id);
  if (existingIndex > -1) {
    session.pendingTasks[existingIndex] = task;
  } else {
    session.pendingTasks.push(task);
  }
  markDirty(sessionId);
}