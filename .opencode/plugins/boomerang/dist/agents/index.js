export { BaseAgent, createAgentContext, getAgentConfig, getDefaultModelForAgent, AGENT_CONFIGS, } from "./base-agent.js";
export { CoderAgent, createCoderAgent } from "./coder-agent.js";
export { ArchitectAgent, createArchitectAgent } from "./architect-agent.js";
export { TesterAgent, createTesterAgent } from "./tester-agent.js";
export { LinterAgent, createLinterAgent } from "./linter-agent.js";
export { GitAgent, createGitAgent } from "./git-agent.js";
import { createCoderAgent } from "./coder-agent.js";
import { createArchitectAgent } from "./architect-agent.js";
import { createTesterAgent } from "./tester-agent.js";
import { createLinterAgent } from "./linter-agent.js";
import { createGitAgent } from "./git-agent.js";
export function createAgent(type, ctx) {
    switch (type) {
        case "coder":
            return createCoderAgent(ctx);
        case "architect":
            return createArchitectAgent(ctx);
        case "tester":
            return createTesterAgent(ctx);
        case "linter":
            return createLinterAgent(ctx);
        case "git":
            return createGitAgent(ctx);
        default:
            throw new Error(`Unknown agent type: ${type}`);
    }
}
export { CoderAgent as BoomerangCoder } from "./coder-agent.js";
export { ArchitectAgent as BoomerangArchitect } from "./architect-agent.js";
export { TesterAgent as BoomerangTester } from "./tester-agent.js";
export { LinterAgent as BoomerangLinter } from "./linter-agent.js";
export { GitAgent as BoomerangGit } from "./git-agent.js";
