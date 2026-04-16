export interface Task {
    id: string;
    description: string;
    dependencies: string[];
    parallelGroup?: number;
    agent?: "orchestrator" | "coder" | "architect" | "tester" | "linter" | "git";
    model?: string;
    status: "pending" | "running" | "completed" | "failed";
    result?: string;
    notes?: string;
}
export interface Decision {
    agent: string;
    summary: string;
    reasoning?: string;
    timestamp: string;
}
export interface DAG {
    nodes: Task[];
    parallelGroups: Task[][];
    sequentialTasks: Task[];
    totalTasks: number;
}
export interface ExecutionPlan {
    dag: DAG;
    executionOrder: ExecutionPhase[];
    estimatedParallelism: number;
}
export interface ExecutionPhase {
    phase: number;
    type: "parallel" | "sequential";
    tasks: Task[];
}
export declare function parseTasksFromPrompt(prompt: string): Task[];
export declare function detectImplicitDependencies(tasks: Task[]): Task[];
export declare function buildDAG(tasks: Task[]): DAG;
export declare function createExecutionPlan(dag: DAG): ExecutionPlan;
export declare function formatDAGForPrompt(dag: DAG): string;
export declare function assignAgentsToTasks(tasks: Task[]): Task[];
