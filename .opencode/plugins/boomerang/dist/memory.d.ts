export interface MemoryEntry {
    id?: string;
    content: string;
    tags?: string[];
    createdAt?: string;
}
export interface MemorySearchResult {
    id: string;
    content: string;
    score: number;
}
export declare class BoomerangMemory {
    private apiKey;
    private apiUrl;
    constructor(apiKey?: string, apiUrl?: string);
    addMemory(content: string, tags?: string[]): Promise<{
        success: boolean;
        id?: string;
        error?: string;
    }>;
    searchMemory(query: string, limit?: number): Promise<{
        success: boolean;
        results?: MemorySearchResult[];
        error?: string;
    }>;
    listMemories(limit?: number): Promise<{
        success: boolean;
        memories?: MemoryEntry[];
        error?: string;
    }>;
    formatContextForInjection(searchResults: MemorySearchResult[]): string;
}
export declare const boomerangMemory: BoomerangMemory;
