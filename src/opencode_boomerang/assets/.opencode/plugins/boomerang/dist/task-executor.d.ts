import type { createOpencodeClient } from "@opencode-ai/sdk";
export interface BoomerangContext {
    sessionId: string;
    directory: string;
    worktree: string;
    client: ReturnType<typeof createOpencodeClient>;
}
export interface TaskResult {
    taskId: string;
    success: boolean;
    output: string;
    error?: string;
}
export interface ExecutionResult {
    phase: number;
    type: "parallel" | "sequential";
    results: TaskResult[];
    allSuccess: boolean;
}
export declare const MODEL_ROUTING: Record<string, string>;
export declare const AGENT_SYSTEM_PROMPTS: Record<string, string>;
export declare function executeTaskInSession(ctx: BoomerangContext, task: {
    id: string;
    description: string;
    agent?: string;
}, model?: string): Promise<TaskResult>;
export declare function executeParallelTasks(ctx: BoomerangContext, tasks: Array<{
    id: string;
    description: string;
    agent?: string;
}>, model?: string): Promise<TaskResult[]>;
export declare function executeSequentialTasks(ctx: BoomerangContext, tasks: Array<{
    id: string;
    description: string;
    agent?: string;
}>, model?: string): Promise<TaskResult[]>;
export declare function aggregateResults(results: ExecutionResult[]): {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    allPassed: boolean;
    summary: string;
};
