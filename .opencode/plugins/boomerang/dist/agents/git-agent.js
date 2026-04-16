import { BaseAgent } from "./base-agent.js";
export class GitAgent extends BaseAgent {
    constructor(ctx) {
        super(ctx, "git");
    }
    async getStatus() {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Git Agent. Get the current git status.

Run \`git status\` and \`git branch -v\` and report:
1. Current branch
2. Whether there are uncommitted changes
3. List of staged files
4. List of unstaged files
5. List of untracked files
6. How many commits ahead/behind remote

Report the full git status.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async commitCheckpoint(message = "wip: checkpoint") {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Git Agent. Create a checkpoint commit.

Run:
1. \`git add -A\`
2. \`git commit -m "${message}"\`

Report the commit hash and message.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async commitWithMessage(message) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Git Agent. Commit with a meaningful message.

Run:
1. \`git add -A\`
2. \`git commit -m "${message}"\`

The message should be descriptive and follow conventional commits if applicable.

Report the commit hash.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async createBranch(branchName, baseBranch) {
        const startTime = Date.now();
        try {
            const base = baseBranch || "main";
            const prompt = `You are the Boomerang Git Agent. Create a new branch.

Run:
1. \`git checkout -b ${branchName} ${base}\`

Report the result.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async checkout(branchName) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Git Agent. Checkout a branch.

Run: \`git checkout ${branchName}\`

Report the result.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async push(branch) {
        const startTime = Date.now();
        try {
            const cmd = branch ? `git push origin ${branch}` : "git push";
            const prompt = `You are the Boomerang Git Agent. Push to remote.

Run: \`${cmd}\`

Report the result.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async pull() {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Git Agent. Pull from remote.

Run: \`git pull\`

Report any conflicts or updates.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
    async viewDiff(filePath) {
        const startTime = Date.now();
        try {
            const cmd = filePath ? `git diff ${filePath}` : "git diff";
            const prompt = `You are the Boomerang Git Agent. View changes.

Run: \`${cmd}\`

Show the full diff output.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "git",
                duration: Date.now() - startTime,
            };
        }
    }
}
export function createGitAgent(ctx) {
    return new GitAgent(ctx);
}
