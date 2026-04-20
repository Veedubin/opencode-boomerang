import { Task, TaskWithAgent, DAG, ExecutionPlan } from "./types.js";
export declare function parseTasksFromPrompt(prompt: string): Task[];
export declare function detectImplicitDependencies(tasks: Task[]): Task[];
export declare function buildDAG(tasks: TaskWithAgent[]): DAG;
export declare function createExecutionPlan(dag: DAG): ExecutionPlan;
export declare function formatDAGForPrompt(dag: DAG): string;
export declare function assignAgentsToTasks(tasks: Task[]): TaskWithAgent[];
//# sourceMappingURL=task-parser.d.ts.map