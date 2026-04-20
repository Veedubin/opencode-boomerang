import { SessionState, Task } from "./types.js";
export declare function getOrCreateSession(sessionId: string): SessionState;
export declare function getSessionState(sessionId: string): SessionState | null;
export declare function markDirty(sessionId: string): void;
export declare function isDirty(sessionId: string): boolean;
export declare function clearDirty(sessionId: string): void;
export declare function updateTask(sessionId: string, task: Task): void;
export declare function recordDecision(sessionId: string, agent: string, summary: string, reasoning?: string): void;
export declare function addNote(sessionId: string, taskId: string, note: string): void;
export declare function getSessionContext(sessionId: string): SessionState | null;
export declare function removeSession(sessionId: string): void;
export declare function getAllDirtySessions(): string[];
//# sourceMappingURL=session-state.d.ts.map