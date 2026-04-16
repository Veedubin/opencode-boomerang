import type { Task } from "./task-parser.js";
export declare function updateTASKSMD(sessionId: string, session: {
    completedTasks: Task[];
    pendingTasks: Task[];
    agentDecisions: Array<{
        agent: string;
        summary: string;
        timestamp: string;
    }>;
    lastUsedAt: number;
}): Promise<void>;
export declare function updateTaskInSession(sessionId: string, task: Task): void;
