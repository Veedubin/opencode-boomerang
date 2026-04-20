export class BoomerangMemory {
    apiKey;
    apiUrl;
    constructor(apiKey, apiUrl) {
        this.apiKey = apiKey || "";
        this.apiUrl = apiUrl || "https://mcp.supermemory.ai/mcp";
    }
    async addMemory(content, tags) {
        if (!this.apiKey) {
            return { success: false, error: "No API key configured" };
        }
        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: {
                        name: "add",
                        arguments: { content, tags },
                    },
                    id: 1,
                }),
            });
            const data = await response.json();
            return { success: true, id: data.result?.id };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async searchMemory(query, limit = 5) {
        if (!this.apiKey) {
            return { success: false, error: "No API key configured" };
        }
        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: {
                        name: "search",
                        arguments: { query, limit },
                    },
                    id: 1,
                }),
            });
            const data = await response.json();
            return {
                success: true,
                results: data.result || [],
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async listMemories(limit = 20) {
        if (!this.apiKey) {
            return { success: false, error: "No API key configured" };
        }
        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: {
                        name: "list",
                        arguments: { limit },
                    },
                    id: 1,
                }),
            });
            const data = await response.json();
            return {
                success: true,
                memories: data.result || [],
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    formatContextForInjection(searchResults) {
        if (searchResults.length === 0) {
            return "";
        }
        let context = "\n\n## Relevant Past Context (from memory)\n\n";
        for (const result of searchResults) {
            context += `- ${result.content}\n`;
        }
        context += "\n";
        return context;
    }
}
export const boomerangMemory = new BoomerangMemory();
//# sourceMappingURL=memory.js.map