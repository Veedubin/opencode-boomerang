/*
 * Boomerang Memory - Tiered Search System
 * ========================================
 * TIERED = "Fast Reply" mode: Quick MiniLM search first, BGE fallback on low confidence misses
 * PARALLEL = "Archivist" mode: Searches both tiers simultaneously with RRF fusion for high recall
 */
export class BoomerangMemory {
    apiKey;
    apiUrl;
    config;
    constructor(config, apiKey, apiUrl) {
        this.apiKey = apiKey || process.env.SUPER_MEMORY_API_KEY || "";
        this.apiUrl = apiUrl || process.env.SUPER_MEMORY_API_URL || "https://mcp.supermemory.ai/mcp";
        this.config = {
            strategy: process.env.EMBEDDING_STRATEGY || "TIERED",
            bgeThreshold: parseFloat(process.env.BGE_THRESHOLD || "0.72"),
            autoSummarizeInterval: parseInt(process.env.AUTO_SUMMARIZE_INTERVAL || "15", 10),
            miniLMDimensions: 384,
            bgeDimensions: 1024,
            ...config,
        };
    }
    // Save to transient tier (MiniLM)
    async addMemory(content, tags, project, metadata) {
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
                        arguments: {
                            content,
                            tags,
                            metadata: {
                                ...metadata,
                                source_model: "minilm",
                                tier: "transient",
                                project,
                            },
                        },
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
    // Save to permanent tier (BGE-Large)
    async addMemoryLong(content, project, tags, metadata, forceHighPrecision = true) {
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
                        name: "save_memory_long",
                        arguments: {
                            content,
                            project,
                            tags,
                            metadata: {
                                ...metadata,
                                source_model: "bge-large",
                                tier: "permanent",
                                force_high_precision: forceHighPrecision,
                            },
                        },
                    },
                    id: 1,
                }),
            });
            const data = await response.json();
            return {
                success: true,
                id: data.result?.id,
                embeddingModel: "bge-large",
                dimensions: 1024,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // Search with strategy-aware logic
    async searchMemory(query, limit = 5, project, overrideStrategy) {
        if (!this.apiKey) {
            return { success: false, error: "No API key configured" };
        }
        const strategy = overrideStrategy || this.config.strategy;
        if (strategy === "TIERED") {
            return this.searchMemoryTiered(query, limit, project);
        }
        else {
            return this.searchMemoryParallel(query, limit, project);
        }
    }
    // TIERED strategy: MiniLM first, BGE fallback if confidence is low
    async searchMemoryTiered(query, limit, project) {
        try {
            // Search MiniLM first
            const miniLMResult = await this.searchMiniLM(query, limit, project);
            if (!miniLMResult.success) {
                return miniLMResult;
            }
            const topResult = miniLMResult.results?.[0];
            const confidence = topResult?.metadata?.confidence ?? topResult?.metadata?.score ?? 0.9;
            // If above threshold, return MiniLM results only
            if (confidence >= this.config.bgeThreshold) {
                return {
                    success: true,
                    results: miniLMResult.results,
                    strategy: "TIERED",
                    tierSearched: ["minilm"],
                    confidence,
                };
            }
            // Below threshold - search BGE as fallback
            const bgeResult = await this.searchBGE(query, limit, project);
            if (!bgeResult.success) {
                return {
                    success: true,
                    results: miniLMResult.results,
                    strategy: "TIERED",
                    tierSearched: ["minilm"],
                    confidence,
                };
            }
            // Combine results, BGE results first (higher quality)
            const combinedResults = [...(bgeResult.results || []), ...(miniLMResult.results || [])];
            const seen = new Set();
            const deduped = combinedResults.filter((r) => {
                if (seen.has(r.id))
                    return false;
                seen.add(r.id);
                return true;
            });
            return {
                success: true,
                results: deduped.slice(0, limit),
                strategy: "TIERED",
                tierSearched: ["minilm", "bge"],
                confidence: bgeResult.results?.[0]?.metadata?.confidence ?? bgeResult.confidence ?? confidence,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // PARALLEL strategy: Search both indexes, merge with RRF
    async searchMemoryParallel(query, limit, project) {
        try {
            // Fire both searches simultaneously
            const [miniLMResult, bgeResult] = await Promise.all([
                this.searchMiniLM(query, limit, project),
                this.searchBGE(query, limit, project),
            ]);
            const miniLMEntries = miniLMResult.results || [];
            const bgeEntries = bgeResult.results || [];
            // Apply RRF fusion
            const rrfResults = this.reciprocalRankFusion(miniLMEntries, bgeEntries, 60);
            return {
                success: true,
                results: rrfResults.slice(0, limit).map((r) => r.entry),
                strategy: "PARALLEL",
                tierSearched: ["minilm", "bge"],
                confidence: rrfResults[0]?.score,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // Search only transient tier (MiniLM)
    async searchMiniLM(query, limit = 5, project) {
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
                        arguments: { query, limit, project },
                    },
                    id: 1,
                }),
            });
            const data = await response.json();
            const results = (data.result || []).map((r) => ({
                ...r,
                sourceModel: "minilm",
                tier: "transient",
            }));
            return {
                success: true,
                results,
                tierSearched: ["minilm"],
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // Search only permanent tier (BGE)
    async searchBGE(query, limit = 5, project) {
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
                        name: "search_long",
                        arguments: { query, limit, project },
                    },
                    id: 1,
                }),
            });
            const data = await response.json();
            const results = (data.result || []).map((r) => ({
                ...r,
                sourceModel: "bge-large",
                tier: "permanent",
            }));
            return {
                success: true,
                results,
                tierSearched: ["bge"],
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // List memories with optional tier filter
    async listMemories(limit = 20, tier) {
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
            let memories = (data.result || []).map((r) => ({
                ...r,
                sourceModel: r.metadata?.source_model || "minilm",
                tier: r.metadata?.tier || "transient",
            }));
            // Filter by tier if specified
            if (tier) {
                memories = memories.filter((m) => m.tier === tier);
            }
            return {
                success: true,
                memories,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    // RRF Fusion for PARALLEL mode
    reciprocalRankFusion(miniLMResults, bgeResults, k = 60) {
        const scores = new Map();
        miniLMResults.forEach((entry, idx) => {
            const id = entry.id;
            if (!scores.has(id))
                scores.set(id, { entry, score: 0, sources: new Set(), ranks: [] });
            scores.get(id).score += 1 / (k + idx + 1);
            scores.get(id).sources.add("minilm");
            scores.get(id).ranks.push(idx + 1);
        });
        bgeResults.forEach((entry, idx) => {
            const id = entry.id;
            if (!scores.has(id))
                scores.set(id, { entry, score: 0, sources: new Set(), ranks: [] });
            scores.get(id).score += 1 / (k + idx + 1);
            scores.get(id).sources.add("bge");
            scores.get(id).ranks.push(idx + 1);
        });
        return Array.from(scores.values())
            .sort((a, b) => b.score - a.score)
            .map((item) => ({
            entry: item.entry,
            score: item.score,
            sourceTier: item.sources.has("bge") ? "bge" : "minilm",
            originalRank: Math.min(...item.ranks),
        }));
    }
    // Format context for injection into prompts
    formatContextForInjection(searchResults) {
        if (searchResults.length === 0) {
            return "";
        }
        let context = "\n\n## Relevant Past Context (from memory)\n\n";
        for (const result of searchResults) {
            const tierLabel = result.tier ? `[${result.tier}]` : "";
            context += `- ${tierLabel} ${result.content}\n`;
        }
        context += "\n";
        return context;
    }
}
export function generateSessionSummary(session) {
    const completedCount = session.completedTasks.length;
    const pendingCount = session.pendingTasks.length;
    const decisions = session.agentDecisions;
    let summary = `## Session Summary: ${session.sessionId}\n\n`;
    summary += `**Status:** ${session.dirty ? "Dirty" : "Clean"}\n`;
    summary += `**Tasks:** ${completedCount} completed, ${pendingCount} pending\n`;
    summary += `**Duration:** ${Math.round((Date.now() - session.createdAt) / 60000)} minutes\n\n`;
    if (decisions.length > 0) {
        summary += `### Key Decisions\n`;
        for (const decision of decisions.slice(-5)) {
            summary += `- **${decision.agent}**: ${decision.summary}\n`;
        }
        summary += `\n`;
    }
    if (session.pendingTasks.length > 0) {
        summary += `### Pending Work\n`;
        for (const task of session.pendingTasks) {
            summary += `- [${task.status}] ${task.description}\n`;
        }
    }
    return summary;
}
export const boomerangMemory = new BoomerangMemory();
//# sourceMappingURL=memory.js.map