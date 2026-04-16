import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent.js";
export interface GitStatus {
    branch: string;
    isDirty: boolean;
    staged: string[];
    unstaged: string[];
    untracked: string[];
    ahead: number;
    behind: number;
}
export declare class GitAgent extends BaseAgent {
    constructor(ctx: AgentContext);
    getStatus(): Promise<AgentResult & {
        status?: GitStatus;
    }>;
    commitCheckpoint(message?: string): Promise<AgentResult>;
    commitWithMessage(message: string): Promise<AgentResult>;
    createBranch(branchName: string, baseBranch?: string): Promise<AgentResult>;
    checkout(branchName: string): Promise<AgentResult>;
    push(branch?: string): Promise<AgentResult>;
    pull(): Promise<AgentResult>;
    viewDiff(filePath?: string): Promise<AgentResult>;
}
export declare function createGitAgent(ctx: AgentContext): GitAgent;
