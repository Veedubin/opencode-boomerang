const sessions = new Map();
export function getOrCreateSession(sessionId) {
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
        });
    }
    const session = sessions.get(sessionId);
    session.lastUsedAt = Date.now();
    return session;
}
export function getSessionState(sessionId) {
    return sessions.get(sessionId) ?? null;
}
export function markDirty(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        session.dirty = true;
    }
}
export function isDirty(sessionId) {
    const session = sessions.get(sessionId);
    return session?.dirty ?? false;
}
export function clearDirty(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        session.dirty = false;
    }
}
export function updateTask(sessionId, task) {
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
    }
    else {
        const alreadyPending = session.pendingTasks.find((t) => t.id === task.id);
        if (!alreadyPending) {
            session.pendingTasks.push(task);
        }
    }
    markDirty(sessionId);
}
export function recordDecision(sessionId, agent, summary, reasoning) {
    const session = getOrCreateSession(sessionId);
    session.agentDecisions.push({
        agent,
        summary,
        reasoning,
        timestamp: new Date().toISOString(),
    });
    markDirty(sessionId);
}
export function addNote(sessionId, taskId, note) {
    const session = getOrCreateSession(sessionId);
    session.notes.set(taskId, note);
    markDirty(sessionId);
}
export function getSessionContext(sessionId) {
    return sessions.get(sessionId) ?? null;
}
export function removeSession(sessionId) {
    sessions.delete(sessionId);
}
export function getAllDirtySessions() {
    const dirty = [];
    for (const [sessionId, session] of sessions) {
        if (session.dirty) {
            dirty.push(sessionId);
        }
    }
    return dirty;
}
