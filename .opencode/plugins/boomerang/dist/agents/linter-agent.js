import { BaseAgent } from "./base-agent.js";
export class LinterAgent extends BaseAgent {
    constructor(ctx) {
        super(ctx, "linter");
    }
    async lintFile(filePath) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Linter. Lint the following file:

File: ${filePath}

Run linting and provide:
1. Any issues found (errors, warnings, style violations)
2. Suggested fixes for each issue
3. Code quality score if applicable

Run the linter and report findings.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
    }
    async lintProject() {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Linter. Run full project linting.

Run lint across the entire project and provide:
1. Summary of issues found
2. Error count, warning count
3. Files with most issues
4. Common patterns of issues
5. Recommended fixes

Run the full linter and report.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
    }
    async fixLintErrors(filePath) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Linter. Fix lint errors${filePath ? ` in ${filePath}` : " in the project"}.

Automatically fix all fixable lint errors:
1. Run lint with --fix flag
2. Review any unfixable issues
3. Manually fix what can be fixed
4. Report what was fixed and what remains

Execute the fixes now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
    }
    async checkCodeStyle(code) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Linter. Check code style${code ? " for the following code" : ""}:

${code || ""}

Report:
1. Style violations found
2. Compliance with project style guide
3. Formatting issues
4. Naming convention violations
5. Suggested corrections

Review the code style.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "linter",
                duration: Date.now() - startTime,
            };
        }
    }
}
export function createLinterAgent(ctx) {
    return new LinterAgent(ctx);
}
