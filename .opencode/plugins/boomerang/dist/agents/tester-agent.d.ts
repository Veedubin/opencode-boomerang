import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent.js";
export declare class TesterAgent extends BaseAgent {
    constructor(ctx: AgentContext);
    writeUnitTests(testDescription: string, codeToTest?: string): Promise<AgentResult>;
    writeIntegrationTests(testDescription: string): Promise<AgentResult>;
    verifyFix(bugDescription: string, fixDescription: string): Promise<AgentResult>;
    runExistingTests(): Promise<AgentResult>;
}
export declare function createTesterAgent(ctx: AgentContext): TesterAgent;
