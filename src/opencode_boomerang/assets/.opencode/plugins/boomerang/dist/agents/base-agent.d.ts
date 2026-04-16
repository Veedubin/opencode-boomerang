import type { createOpencodeClient } from "@opencode-ai/sdk";
export type AgentType = "orchestrator" | "coder" | "architect" | "tester" | "linter" | "git";
export interface AgentConfig {
    type: AgentType;
    model: string;
    name: string;
    description: string;
    systemPrompt: string;
}
export interface AgentContext {
    client: ReturnType<typeof createOpencodeClient>;
    sessionId: string;
    directory: string;
    worktree: string;
}
export interface AgentResult {
    success: boolean;
    output: string;
    error?: string;
    agent: AgentType;
    duration?: number;
}
export declare const AGENT_CONFIGS: Record<AgentType, AgentConfig>;
export declare class BaseAgent {
    protected ctx: AgentContext;
    protected config: AgentConfig;
    constructor(ctx: AgentContext, type: AgentType);
    protected runPrompt(prompt: string, noReply?: boolean): Promise<string>;
    getConfig(): AgentConfig;
    getContext(): AgentContext;
}
export declare function createAgentContext(client: ReturnType<typeof createOpencodeClient>, sessionId: string, directory: string, worktree: string): AgentContext;
export declare function getAgentConfig(type: AgentType): AgentConfig;
export declare function getDefaultModelForAgent(type: AgentType): string;
