import { BaseAgent } from "./base-agent.js";
export class CoderAgent extends BaseAgent {
    constructor(ctx) {
        super(ctx, "coder");
    }
    async implementFeature(taskDescription, context) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Coder. Implement the following feature:

Task: ${taskDescription}
${context ? `\nContext:\n${context}` : ""}

Requirements:
- Write clean, idiomatic code
- Follow existing project conventions
- Add tests for your implementation
- Do NOT add unnecessary comments
- Keep functions small and focused

Execute the implementation now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
    }
    async fixBug(bugDescription, relevantCode) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Coder. Fix the following bug:

Bug: ${bugDescription}
${relevantCode ? `\nRelevant Code:\n${relevantCode}` : ""}

Requirements:
- Identify the root cause
- Fix the bug without introducing new issues
- Write a test to prevent regression
- Follow existing code style

Execute the fix now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
    }
    async refactorCode(codeDescription, code) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Coder. Refactor the following code:

Description: ${codeDescription}
${code ? `\nCode to Refactor:\n${code}` : ""}

Requirements:
- Improve code quality without changing behavior
- Make the code more maintainable
- Keep functions small and focused
- Follow existing conventions

Execute the refactoring now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
    }
    async writeTests(testDescription, codeToTest) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Coder. Write tests for the following:

Description: ${testDescription}
${codeToTest ? `\nCode to Test:\n${codeToTest}` : ""}

Requirements:
- Write comprehensive unit tests
- Cover happy path and edge cases
- Follow existing test patterns
- Use appropriate assertions

Execute the test writing now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "coder",
                duration: Date.now() - startTime,
            };
        }
    }
}
export function createCoderAgent(ctx) {
    return new CoderAgent(ctx);
}
