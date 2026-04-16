import type { Decision } from "./task-parser.js";
export declare function updateAGENTSMD(sessionId: string, session: {
    agentDecisions: Decision[];
    completedTasks: Array<{
        agent?: string;
        description: string;
    }>;
    pendingTasks: Array<{
        agent?: string;
        description: string;
    }>;
    lastUsedAt: number;
}): Promise<void>;
export declare function recordDecisionInSession(sessionId: string, agent: string, summary: string, reasoning?: string): void;
