import { OrchestratorContext, BoomerangConfig, ExecutionPlan, PhaseResult } from "./types.js";
export declare class BoomerangOrchestrator {
    private ctx;
    private config;
    private $;
    constructor(ctx: OrchestratorContext, config: BoomerangConfig, shellRunner: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>);
    run(prompt: string): Promise<{
        success: boolean;
        tasks: any[];
        dag: any;
        executionPlan: ExecutionPlan;
        executionResults: PhaseResult[];
        qualityGateResults: {
            allPassed: boolean;
            summary: string;
        };
        gitCommit?: {
            hash: string;
            message: string;
        };
        memorySaved: boolean;
        summary: string;
    }>;
    private fetchMemoryContext;
    private executePlan;
    private formatSummary;
}
export declare function createBoomerangOrchestrator(ctx: OrchestratorContext, config: BoomerangConfig, shellRunner: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>): BoomerangOrchestrator;
//# sourceMappingURL=orchestrator.d.ts.map