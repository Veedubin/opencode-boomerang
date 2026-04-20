export class MiddlewareRegistry {
    middlewares = new Map();
    register(middleware) {
        const existing = this.middlewares.get(middleware.hook) || [];
        existing.push(middleware);
        this.middlewares.set(middleware.hook, existing);
    }
    async execute(hook, context, finalAction) {
        const chain = this.middlewares.get(hook) || [];
        let index = 0;
        const next = async () => {
            if (index >= chain.length) {
                return finalAction();
            }
            const middleware = chain[index++];
            return middleware.execute(context, next);
        };
        return next();
    }
    list() {
        const result = [];
        for (const [hook, middlewares] of this.middlewares) {
            result.push({
                hook,
                names: middlewares.map((m) => m.name),
            });
        }
        return result;
    }
}
export const globalMiddleware = new MiddlewareRegistry();
// Built-in middleware examples
export const loggingMiddleware = {
    name: "logging",
    hook: "wrap_model_call",
    execute: async (context, next) => {
        console.log(`[MODEL_CALL] ${context.model || "unknown"}`);
        const result = await next();
        console.log(`[MODEL_RESULT] ${result ? "success" : "empty"}`);
        return result;
    },
};
export const cachingMiddleware = {
    name: "caching",
    hook: "wrap_tool_call",
    execute: async (_context, next) => {
        // Simple in-memory cache could go here
        return next();
    },
};
//# sourceMappingURL=middleware.js.map