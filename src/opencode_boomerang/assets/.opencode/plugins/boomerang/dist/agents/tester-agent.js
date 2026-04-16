import { BaseAgent } from "./base-agent.js";
export class TesterAgent extends BaseAgent {
    constructor(ctx) {
        super(ctx, "tester");
    }
    async writeUnitTests(testDescription, codeToTest) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Tester. Write unit tests for:

Description: ${testDescription}
${codeToTest ? `\nCode to Test:\n${codeToTest}` : ""}

Requirements:
- Write comprehensive unit tests
- Cover happy path AND edge cases
- Use appropriate test framework (jest, mocha, etc.)
- Follow existing test patterns in the project
- Include descriptive test names
- Mock external dependencies where appropriate

Write the tests now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
    }
    async writeIntegrationTests(testDescription) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Tester. Write integration tests for:

Description: ${testDescription}

Requirements:
- Test how components work together
- Cover API endpoints if applicable
- Include setup and teardown
- Test real data flows
- Follow project testing conventions

Write the integration tests now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
    }
    async verifyFix(bugDescription, fixDescription) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Tester. Verify a bug fix:

Bug: ${bugDescription}
Fix: ${fixDescription}

Requirements:
- Confirm the fix actually resolves the issue
- Write a regression test
- Verify no new issues were introduced
- Test edge cases around the fix

Verify the fix and write tests now.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
    }
    async runExistingTests() {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Tester. Run the existing test suite.

Run all tests and report:
1. Which tests passed
2. Which tests failed
3. Any errors or warnings
4. Code coverage if available

Execute the tests and report results.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "tester",
                duration: Date.now() - startTime,
            };
        }
    }
}
export function createTesterAgent(ctx) {
    return new TesterAgent(ctx);
}
