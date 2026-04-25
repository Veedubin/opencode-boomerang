export type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

export interface MiddlewareContext {
  sessionId: string;
  taskId: string;
  agent: string;
  taskDescription: string;
  metadata: Record<string, unknown>;
}

export class MiddlewarePipeline {
  private middlewares: MiddlewareFn[] = [];

  use(fn: MiddlewareFn): void {
    this.middlewares.push(fn);
  }

  async execute(ctx: MiddlewareContext, finalHandler: () => Promise<void>): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(ctx, next);
      } else {
        await finalHandler();
      }
    };
    await next();
  }
}

export const globalMiddleware = new MiddlewarePipeline();