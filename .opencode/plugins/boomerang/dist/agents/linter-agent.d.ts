import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent.js";
export declare class LinterAgent extends BaseAgent {
    constructor(ctx: AgentContext);
    lintFile(filePath: string): Promise<AgentResult>;
    lintProject(): Promise<AgentResult>;
    fixLintErrors(filePath?: string): Promise<AgentResult>;
    checkCodeStyle(code?: string): Promise<AgentResult>;
}
export declare function createLinterAgent(ctx: AgentContext): LinterAgent;
