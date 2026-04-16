import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent.js";
export declare class ArchitectAgent extends BaseAgent {
    constructor(ctx: AgentContext);
    designFeature(featureDescription: string, requirements?: string): Promise<AgentResult>;
    reviewArchitecture(codebase?: string): Promise<AgentResult>;
    evaluateTradeoffs(optionA: string, optionB: string, context?: string): Promise<AgentResult>;
    suggestPatterns(problemDescription: string): Promise<AgentResult>;
}
export declare function createArchitectAgent(ctx: AgentContext): ArchitectAgent;
