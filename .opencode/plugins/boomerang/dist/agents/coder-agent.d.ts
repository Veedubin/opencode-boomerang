import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent.js";
export declare class CoderAgent extends BaseAgent {
    constructor(ctx: AgentContext);
    implementFeature(taskDescription: string, context?: string): Promise<AgentResult>;
    fixBug(bugDescription: string, relevantCode?: string): Promise<AgentResult>;
    refactorCode(codeDescription: string, code?: string): Promise<AgentResult>;
    writeTests(testDescription: string, codeToTest?: string): Promise<AgentResult>;
}
export declare function createCoderAgent(ctx: AgentContext): CoderAgent;
