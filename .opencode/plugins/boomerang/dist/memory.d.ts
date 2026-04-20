import { MemorySearchResult, MemoryAddResult, MemoryEntry } from "./types.js";
export declare class BoomerangMemory {
    private apiKey;
    private apiUrl;
    constructor(apiKey?: string, apiUrl?: string);
    addMemory(content: string, tags?: string[]): Promise<MemoryAddResult>;
    searchMemory(query: string, limit?: number): Promise<MemorySearchResult>;
    listMemories(limit?: number): Promise<{
        success: boolean;
        memories?: MemoryEntry[];
        error?: string;
    }>;
    formatContextForInjection(searchResults: MemoryEntry[]): string;
}
export declare const boomerangMemory: BoomerangMemory;
//# sourceMappingURL=memory.d.ts.map