import { BaseAgent } from "./base-agent.js";
export class ArchitectAgent extends BaseAgent {
    constructor(ctx) {
        super(ctx, "architect");
    }
    async designFeature(featureDescription, requirements) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Architect. Design the following feature:

Feature: ${featureDescription}
${requirements ? `\nRequirements:\n${requirements}` : ""}

Provide:
1. High-level design overview
2. Component breakdown
3. Data models if applicable
4. API design if applicable
5. Trade-offs considered
6. Recommended implementation approach

Be thorough and consider scalability, maintainability, and performance.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
    }
    async reviewArchitecture(codebase) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Architect. Review the current architecture:

${codebase ? `\nCodebase Context:\n${codebase}` : ""}

Provide:
1. Current architecture overview
2. Strengths of current design
3. Potential issues or technical debt
4. Recommendations for improvement
5. Scalability concerns
6. Maintainability considerations

Be critical but constructive.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
    }
    async evaluateTradeoffs(optionA, optionB, context) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Architect. Evaluate trade-offs between two options:

Option A: ${optionA}
Option B: ${optionB}
${context ? `\nContext:\n${context}` : ""}

Provide:
1. Pros of Option A
2. Cons of Option A
3. Pros of Option B
4. Cons of Option B
5. Recommendation with justification
6. When to choose each option

Be objective and consider the specific context.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
    }
    async suggestPatterns(problemDescription) {
        const startTime = Date.now();
        try {
            const prompt = `You are the Boomerang Architect. Suggest design patterns for:

Problem: ${problemDescription}

Provide:
1. Recommended patterns with rationale
2. Example implementation structure
3. How the patterns solve the problem
4. Potential pitfalls to avoid
5. Alternative approaches

Focus on practical, applicable patterns.`;
            const output = await this.runPrompt(prompt);
            return {
                success: true,
                output,
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                output: "",
                error: String(error),
                agent: "architect",
                duration: Date.now() - startTime,
            };
        }
    }
}
export function createArchitectAgent(ctx) {
    return new ArchitectAgent(ctx);
}
