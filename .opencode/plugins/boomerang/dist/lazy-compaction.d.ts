import type { createOpencodeClient } from "@opencode-ai/sdk";
export interface LazyCompactionConfig {
    enabled: boolean;
    memoryOffloadEnabled: boolean;
    taslsMdUpdateEnabled: boolean;
    agentsMdUpdateEnabled: boolean;
}
export declare function compactSessionIfNeeded(sessionId: string, client: ReturnType<typeof createOpencodeClient>, config?: LazyCompactionConfig): Promise<boolean>;
export declare function compactSession(sessionId: string, client: ReturnType<typeof createOpencodeClient>, config?: LazyCompactionConfig): Promise<string>;
export declare function injectContext(sessionId: string, context: string, client: ReturnType<typeof createOpencodeClient>): Promise<void>;
