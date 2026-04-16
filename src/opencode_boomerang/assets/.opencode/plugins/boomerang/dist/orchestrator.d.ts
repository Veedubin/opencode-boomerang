import { type Task, type DAG, type ExecutionPlan } from "./task-parser.js";
import { type BoomerangContext, type ExecutionResult } from "./task-executor.js";
export interface BoomerangConfig {
    orchestratorModel: string;
    coderModel: string;
    architectModel: string;
    testerModel: string;
    linterModel: string;
    gitCheckBeforeWork: boolean;
    gitCommitAfterWork: boolean;
    qualityGates: {
        lint: boolean;
        typecheck: boolean;
        test: boolean;
    };
    memoryEnabled: boolean;
}
export interface BoomerangResult {
    success: boolean;
    tasks: Task[];
    dag: DAG;
    executionPlan: ExecutionPlan;
    executionResults: ExecutionResult[];
    qualityGateResults: {
        allPassed: boolean;
        summary: string;
    };
    gitCommit?: {
        hash: string;
        message: string;
    };
    memorySaved?: boolean;
    summary: string;
}
export declare class BoomerangOrchestrator {
    private ctx;
    private config;
    private $;
    constructor(ctx: BoomerangContext, config: BoomerangConfig, shellRunner: any);
    run(prompt: string): Promise<BoomerangResult>;
    private fetchMemoryContext;
    private executePlan;
    private formatSummary;
}
export declare function createBoomerangOrchestrator(ctx: BoomerangContext, config: BoomerangConfig, shellRunner: any): BoomerangOrchestrator;
