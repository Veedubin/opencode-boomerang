import { TaskWithAgent, TaskResult, PhaseResult, AggregatedResults } from "./types.js";
import { OrchestratorContext } from "./types.js";
export declare const MODEL_ROUTING: Record<string, string>;
export declare const AGENT_SYSTEM_PROMPTS: Record<string, string>;
export declare function executeTaskInSession(ctx: OrchestratorContext, task: TaskWithAgent, _model: string): Promise<TaskResult>;
export declare function executeParallelTasks(ctx: OrchestratorContext, tasks: TaskWithAgent[], defaultModel: string): Promise<TaskResult[]>;
export declare function executeSequentialTasks(ctx: OrchestratorContext, tasks: TaskWithAgent[], defaultModel: string): Promise<TaskResult[]>;
export declare function aggregateResults(phaseResults: PhaseResult[]): AggregatedResults;
//# sourceMappingURL=task-executor.d.ts.map