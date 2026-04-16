export const AGENT_CONFIGS = {
    orchestrator: {
        type: "orchestrator",
        model: "kimi-k2.5",
        name: "Boomerang Orchestrator",
        description: "Main coordinator, plans and delegates tasks",
        systemPrompt: "You are the Boomerang Orchestrator. You plan, coordinate, and delegate to sub-agents.",
    },
    coder: {
        type: "coder",
        model: "minimax-2.7-highspeed",
        name: "Boomerang Coder",
        description: "Fast code generation specialist",
        systemPrompt: "You are the Boomerang Coder. You write clean, efficient code following project conventions. Use MiniMax M2.7 high-speed for rapid code generation.",
    },
    architect: {
        type: "architect",
        model: "kimi-k2.5",
        name: "Boomerang Architect",
        description: "Design decisions and architecture review",
        systemPrompt: "You are the Boomerang Architect. You make design decisions, evaluate trade-offs, and ensure architectural soundness.",
    },
    tester: {
        type: "tester",
        model: "gemini-3-pro",
        name: "Boomerang Tester",
        description: "Unit and integration testing",
        systemPrompt: "You are the Boomerang Tester. You write comprehensive tests, verify functionality, and ensure code quality.",
    },
    linter: {
        type: "linter",
        model: "minimax-fast",
        name: "Boomerang Linter",
        description: "Code quality and style enforcement",
        systemPrompt: "You are the Boomerang Linter. You enforce code quality, style consistency, and best practices.",
    },
    git: {
        type: "git",
        model: "any",
        name: "Boomerang Git Agent",
        description: "Version control operations",
        systemPrompt: "You are the Boomerang Git Agent. You manage version control, commits, branches, and git workflow.",
    },
};
export class BaseAgent {
    ctx;
    config;
    constructor(ctx, type) {
        this.ctx = ctx;
        this.config = AGENT_CONFIGS[type];
    }
    async runPrompt(prompt, noReply = false) {
        try {
            const result = await this.ctx.client.session.prompt({
                path: { id: this.ctx.sessionId },
                body: {
                    parts: [{ type: "text", text: prompt }],
                    noReply,
                },
            });
            const data = result?.data;
            if (data?.parts?.[0]?.text) {
                return data.parts[0].text;
            }
            if (data?.info?.parts?.[0]?.text) {
                return data.info.parts[0].text;
            }
            return "";
        }
        catch (error) {
            throw new Error(`Prompt failed for ${this.config.name}: ${error}`);
        }
    }
    getConfig() {
        return this.config;
    }
    getContext() {
        return this.ctx;
    }
}
export function createAgentContext(client, sessionId, directory, worktree) {
    return { client, sessionId, directory, worktree };
}
export function getAgentConfig(type) {
    return AGENT_CONFIGS[type];
}
export function getDefaultModelForAgent(type) {
    return AGENT_CONFIGS[type].model;
}
