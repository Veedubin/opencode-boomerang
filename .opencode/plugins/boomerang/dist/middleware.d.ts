import { Middleware, MiddlewareHook } from "./types.js";
export declare class MiddlewareRegistry {
    private middlewares;
    register(middleware: Middleware): void;
    execute(hook: MiddlewareHook, context: any, finalAction: () => Promise<any>): Promise<any>;
    list(): Array<{
        hook: MiddlewareHook;
        names: string[];
    }>;
}
export declare const globalMiddleware: MiddlewareRegistry;
export declare const loggingMiddleware: Middleware;
export declare const cachingMiddleware: Middleware;
//# sourceMappingURL=middleware.d.ts.map