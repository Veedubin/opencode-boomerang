import { SessionState, Task, ExecutionRecord } from "./types.js";

const sessions = new Map<string, SessionState>();

export function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      dirty: false,
      completedTasks: [],
      pendingTasks: [],
      agentDecisions: [],
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      notes: new Map(),
      executionDepth: 0,
      executionHistory: [],
    });
  }
  const session = sessions.get(sessionId)!;
  session.lastUsedAt = Date.now();
  return session;
}

// Depth tracking
export function incrementExecutionDepth(sessionId: string): number {
  const session = getOrCreateSession(sessionId);
  session.executionDepth = (session.executionDepth || 0) + 1;
  return session.executionDepth;
}

export function decrementExecutionDepth(sessionId: string): number {
  const session = getOrCreateSession(sessionId);
  session.executionDepth = Math.max(0, (session.executionDepth || 0) - 1);
  return session.executionDepth;
}

export function getExecutionDepth(sessionId: string): number {
  const session = getSessionState(sessionId);
  return session?.executionDepth || 0;
}

// Execution history
export function recordExecution(
  sessionId: string,
  record: ExecutionRecord
): void {
  const session = getOrCreateSession(sessionId);
  if (!session.executionHistory) {
    session.executionHistory = [];
  }
  session.executionHistory.push(record);
  markDirty(sessionId);
}

export function getSessionState(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function markDirty(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.dirty = true;
  }
}

export function isDirty(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.dirty ?? false;
}

export function clearDirty(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.dirty = false;
  }
}

export function updateTask(sessionId: string, task: Task): void {
  const session = getOrCreateSession(sessionId);
  const existingIndex = session.pendingTasks.findIndex((t) => t.id === task.id);
  if (existingIndex > -1) {
    session.pendingTasks.splice(existingIndex, 1);
  }
  if (task.status === "completed" || task.status === "failed") {
    const alreadyCompleted = session.completedTasks.find((t) => t.id === task.id);
    if (!alreadyCompleted) {
      session.completedTasks.push(task);
    }
  } else {
    const alreadyPending = session.pendingTasks.find((t) => t.id === task.id);
    if (!alreadyPending) {
      session.pendingTasks.push(task);
    }
  }
  markDirty(sessionId);
}

export function recordDecision(
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

export function addNote(sessionId: string, taskId: string, note: string): void {
  const session = getOrCreateSession(sessionId);
  session.notes.set(taskId, note);
  markDirty(sessionId);
}

export function getSessionContext(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function removeSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getAllDirtySessions(): string[] {
  const dirty: string[] = [];
  for (const [sessionId, session] of sessions) {
    if (session.dirty) {
      dirty.push(sessionId);
    }
  }
  return dirty;
}