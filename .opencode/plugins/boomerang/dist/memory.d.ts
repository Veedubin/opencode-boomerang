import { MemorySearchResult, MemoryAddResult, MemorySaveLongResult, MemoryEntry, MemoryTierConfig, EmbeddingStrategy, SessionState } from "./types.js";
export declare class BoomerangMemory {
    private apiKey;
    private apiUrl;
    config: MemoryTierConfig;
    constructor(config?: Partial<MemoryTierConfig>, apiKey?: string, apiUrl?: string);
    addMemory(content: string, tags?: string[], project?: string, metadata?: Record<string, any>): Promise<MemoryAddResult>;
    addMemoryLong(content: string, project: string, tags?: string[], metadata?: Record<string, any>, forceHighPrecision?: boolean): Promise<MemorySaveLongResult>;
    searchMemory(query: string, limit?: number, project?: string, overrideStrategy?: EmbeddingStrategy): Promise<MemorySearchResult>;
    private searchMemoryTiered;
    private searchMemoryParallel;
    searchMiniLM(query: string, limit?: number, project?: string): Promise<MemorySearchResult>;
    searchBGE(query: string, limit?: number, project?: string): Promise<MemorySearchResult>;
    listMemories(limit?: number, tier?: "transient" | "permanent"): Promise<{
        success: boolean;
        memories?: MemoryEntry[];
        error?: string;
    }>;
    private reciprocalRankFusion;
    formatContextForInjection(searchResults: MemoryEntry[]): string;
}
export declare function generateSessionSummary(session: SessionState): string;
export declare const boomerangMemory: BoomerangMemory;
//# sourceMappingURL=memory.d.ts.map