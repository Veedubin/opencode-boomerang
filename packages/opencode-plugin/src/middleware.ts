import { Middleware, MiddlewareHook } from "./types.js";

export class MiddlewareRegistry {
  private middlewares: Map<MiddlewareHook, Middleware[]> = new Map();

  register(middleware: Middleware): void {
    const existing = this.middlewares.get(middleware.hook) || [];
    existing.push(middleware);
    this.middlewares.set(middleware.hook, existing);
  }

  async execute(
    hook: MiddlewareHook,
    context: any,
    finalAction: () => Promise<any>
  ): Promise<any> {
    const chain = this.middlewares.get(hook) || [];
    let index = 0;
    const next = async (): Promise<any> => {
      if (index >= chain.length) {
        return finalAction();
      }
      const middleware = chain[index++];
      return middleware.execute(context, next);
    };
    return next();
  }

  list(): Array<{ hook: MiddlewareHook; names: string[] }> {
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
export const loggingMiddleware: Middleware = {
  name: "logging",
  hook: "wrap_model_call",
  execute: async (context, next) => {
    console.log(`[MODEL_CALL] ${context.model || "unknown"}`);
    const result = await next();
    console.log(`[MODEL_RESULT] ${result ? "success" : "empty"}`);
    return result;
  },
};

export const cachingMiddleware: Middleware = {
  name: "caching",
  hook: "wrap_tool_call",
  execute: async (_context, next) => {
    // Simple in-memory cache could go here
    return next();
  },
};