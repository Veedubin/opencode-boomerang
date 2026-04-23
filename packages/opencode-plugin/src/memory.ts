import { MemorySearchResult, MemoryAddResult, MemorySaveLongResult, MemoryEntry, MemoryTierConfig, EmbeddingStrategy, RRFResult, SessionState, ProjectSearchResult, McpMemoryEntry } from "./types.js";
import { MemoryClient, initializeMemoryClient, shutdownMemoryClient } from "./memory-client.js";
import { BuiltInMemory, ProjectMemoryConfig } from "./built-in-memory.js";
import { join } from "path";

/*
 * Boomerang Memory - Tiered Search System
 * ========================================
 * TIERED = "Fast Reply" mode: Quick MiniLM search first, BGE fallback on low confidence misses
 * PARALLEL = "Archivist" mode: Searches both tiers simultaneously with RRF fusion for high recall
 */

export class BoomerangMemory {
  private mcpClient: MemoryClient | null = null;
  private builtInMemory: BuiltInMemory | null = null;
  private config: MemoryTierConfig;
  private useMcp: boolean;

  constructor(config?: Partial<MemoryTierConfig>) {
    this.config = {
      strategy: (process.env.EMBEDDING_STRATEGY as EmbeddingStrategy) || "TIERED",
      bgeThreshold: parseFloat(process.env.BGE_THRESHOLD || "0.72"),
      autoSummarizeInterval: parseInt(process.env.AUTO_SUMMARIZE_INTERVAL || "15", 10),
      miniLMDimensions: 384,
      bgeDimensions: 1024,
      ...config,
    };
    // Check if we should use MCP client (local server preferred)
    this.useMcp = !process.env.SUPER_MEMORY_API_KEY;
  }

  /**
   * Set the MCP client for local Super-Memory-TS connection
   */
  setMcpClient(client: MemoryClient): void {
    this.mcpClient = client;
    this.useMcp = true;
  }

  /**
   * Set the built-in memory instance
   */
  setBuiltInMemory(builtInMem: BuiltInMemory): void {
    this.builtInMemory = builtInMem;
  }

  /**
   * Initialize built-in memory connection
   */
  async initializeBuiltInMemory(projectPath: string, config?: ProjectMemoryConfig): Promise<void> {
    if (!this.builtInMemory) {
      this.builtInMemory = new BuiltInMemory();
    }
    if (!this.builtInMemory.isInitialized()) {
      await this.builtInMemory.initialize(projectPath, config || {
        memoryPath: join(projectPath, '.boomerang', 'memory'),
        indexPath: join(projectPath, '.boomerang', 'index'),
        excludePatterns: ['node_modules', '.git', 'dist', 'build'],
        chunkSize: 512,
      });
    }
  }

  /**
   * Initialize MCP connection
   */
  async initialize(): Promise<void> {
    if (this.useMcp && !this.mcpClient) {
      this.mcpClient = await initializeMemoryClient();
    }
  }

  /**
   * Shutdown MCP connection
   */
  async shutdown(): Promise<void> {
    if (this.mcpClient) {
      await shutdownMemoryClient();
      this.mcpClient = null;
    }
  }

  // Save to memory via built-in memory or MCP (sourceType: boomerang)
  async addMemory(content: string, tags?: string[], project?: string, metadata?: Record<string, any>): Promise<MemoryAddResult> {
    // Try built-in memory first if available
    if (this.builtInMemory && this.builtInMemory.isInitialized()) {
      try {
        const memMetadata = {
          ...metadata,
          ...(project ? { project } : {}),
          tags: tags?.join(",") || "",
        };
        const id = await this.builtInMemory.addMemory(content, memMetadata);
        return { success: true, id };
      } catch (error) {
        // Fall back to MCP if built-in fails
        if (!this.mcpClient) {
          return { success: false, error: "Both built-in memory and MCP client unavailable" };
        }
      }
    }

    // Fall back to MCP client
    if (!this.mcpClient) {
      return { success: false, error: "MCP client not initialized" };
    }
    try {
      const result = await this.mcpClient.addMemory(content, "boomerang", {
        ...metadata,
        ...(project ? { project } : {}),
        tags: tags?.join(",") || "",
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Save to permanent tier (BGE-Large) via built-in memory or MCP
  async addMemoryLong(content: string, project: string, tags?: string[], metadata?: Record<string, any>, _forceHighPrecision = true): Promise<MemorySaveLongResult> {
    // Try built-in memory first if available
    if (this.builtInMemory && this.builtInMemory.isInitialized()) {
      try {
        const memMetadata = {
          ...metadata,
          project,
          tags: tags?.join(",") || "",
        };
        const id = await this.builtInMemory.addMemory(content, memMetadata);
        return {
          success: true,
          id,
          embeddingModel: "bge-large",
          dimensions: 1024,
        };
      } catch (error) {
        // Fall back to MCP if built-in fails
        if (!this.mcpClient) {
          return { success: false, error: "Both built-in memory and MCP client unavailable" };
        }
      }
    }

    if (!this.mcpClient) {
      return { success: false, error: "MCP client not initialized" };
    }
    try {
      const result = await this.mcpClient.addMemory(content, "boomerang", {
        ...metadata,
        project,
        tags: tags?.join(",") || "",
        tier: "permanent",
      });
      return {
        success: result.success,
        id: result.id,
        embeddingModel: "bge-large",
        dimensions: 1024,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Search with strategy-aware logic
  async searchMemory(query: string, limit = 5, project?: string, overrideStrategy?: EmbeddingStrategy): Promise<MemorySearchResult> {
    // Try built-in memory first if available
    if (this.builtInMemory && this.builtInMemory.isInitialized()) {
      try {
        const results = await this.builtInMemory.queryMemories(query, limit);
        const mappedResults: MemoryEntry[] = results.map((r: any) => {
          const metadata = r.metadataJson ? JSON.parse(r.metadataJson) : {};
          return {
            id: r.id,
            content: r.text,
            tags: metadata.tags?.split(",").filter(Boolean) || [],
            createdAt: r.timestamp?.toString(),
            sourceModel: "minilm" as const,
            tier: "transient" as const,
            project: metadata.project || 'unknown',
            metadata: metadata || {},
          };
        });
        return {
          success: true,
          results: mappedResults,
          strategy: overrideStrategy || this.config.strategy,
          tierSearched: ["minilm"],
          confidence: 0.9,
        };
      } catch (error) {
        // Fall back to MCP if built-in fails
        if (!this.mcpClient) {
          return { success: false, error: "Both built-in memory and MCP client unavailable" };
        }
      }
    }

    if (!this.mcpClient) {
      return { success: false, error: "MCP client not initialized" };
    }

    const strategy = overrideStrategy || this.config.strategy;
    if (strategy === "TIERED") {
      return this.searchMemoryTieredMcp(query, limit, project);
    } else {
      return this.searchMemoryParallelMcp(query, limit, project);
    }
  }

  // TIERED strategy: MiniLM first, BGE fallback if confidence is low (via MCP)
  private async searchMemoryTieredMcp(query: string, limit: number, _project?: string): Promise<MemorySearchResult> {
    try {
      if (!this.mcpClient) {
        return { success: false, error: "MCP client not initialized" };
      }

      // Search via MCP
      const result = await this.mcpClient.queryMemories(query, limit);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const entries: McpMemoryEntry[] = result.results || [];
      const confidence = 0.9; // Default confidence since MCP doesn't expose it

      // If above threshold, return results
      if (confidence >= this.config.bgeThreshold) {
        const mappedResults: MemoryEntry[] = entries.map((r) => {
          const metadata = r.metadataJson ? JSON.parse(r.metadataJson) : {};
          return {
            id: r.id,
            content: r.text,
            tags: metadata.tags?.split(",").filter(Boolean) || [],
            createdAt: r.timestamp?.toString(),
            sourceModel: "minilm" as const,
            tier: "transient" as const,
            project: metadata.project || 'unknown',
            metadata: metadata || {},
          };
        });
        return {
          success: true,
          results: mappedResults,
          strategy: "TIERED",
          tierSearched: ["minilm"],
          confidence,
        };
      }

      // Below threshold - return same results with note (MCP doesn't have separate BGE)
      const mappedResultsBge: MemoryEntry[] = entries.map((r) => {
        const metadata = r.metadataJson ? JSON.parse(r.metadataJson) : {};
        return {
          id: r.id,
          content: r.text,
          tags: metadata.tags?.split(",").filter(Boolean) || [],
          createdAt: r.timestamp?.toString(),
          sourceModel: "bge-large" as const,
          tier: "permanent" as const,
          project: metadata.project || 'unknown',
          metadata: metadata || {},
        };
      });
      return {
        success: true,
        results: mappedResultsBge,
        strategy: "TIERED",
        tierSearched: ["minilm", "bge"],
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // PARALLEL strategy: Search via MCP with fusion (simplified since single index)
  private async searchMemoryParallelMcp(query: string, limit: number, _project?: string): Promise<MemorySearchResult> {
    try {
      if (!this.mcpClient) {
        return { success: false, error: "MCP client not initialized" };
      }

      const result = await this.mcpClient.queryMemories(query, limit);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const entries: McpMemoryEntry[] = result.results || [];

      const mappedResults: MemoryEntry[] = entries.map((r) => {
        const metadata = r.metadataJson ? JSON.parse(r.metadataJson) : {};
        return {
          id: r.id,
          content: r.text,
          tags: metadata.tags?.split(",").filter(Boolean) || [],
          createdAt: r.timestamp?.toString(),
          sourceModel: "bge-large" as const,
          tier: "permanent" as const,
          project: metadata.project || 'unknown',
          metadata: metadata || {},
        };
      });

      return {
        success: true,
        results: mappedResults,
        strategy: "PARALLEL",
        tierSearched: ["minilm", "bge"],
        confidence: 0.9,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Search only transient tier (MiniLM)
  async searchMiniLM(query: string, limit = 5, _project?: string): Promise<MemorySearchResult> {
    return this.searchMemory(query, limit, undefined, "TIERED");
  }

  // Search only permanent tier (BGE)
  async searchBGE(query: string, limit = 5, _project?: string): Promise<MemorySearchResult> {
    return this.searchMemory(query, limit, undefined, "PARALLEL");
  }

  // List memories (not directly available in MCP, returns empty)
  async listMemories(limit = 20, tier?: "transient" | "permanent"): Promise<{ success: boolean; memories?: MemoryEntry[]; error?: string }> {
    if (!this.mcpClient) {
      return { success: false, error: "MCP client not initialized" };
    }
    try {
      const result = await this.mcpClient.queryMemories("", limit);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      let memories: MemoryEntry[] = (result.results || []).map((r) => ({
        id: r.id,
        content: r.text,
        sourceModel: "minilm" as const,
        tier: "transient" as const,
      }));

      // Filter by tier if specified
      if (tier) {
        memories = memories.filter((m) => m.tier === tier);
      }

      return {
        success: true,
        memories,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // RRF Fusion for PARALLEL mode (kept for compatibility but not used with MCP)
  // @ts-ignore - Kept for API compatibility, not used with MCP client
  private _reciprocalRankFusion(miniLMResults: MemoryEntry[], bgeResults: MemoryEntry[], k = 60): RRFResult[] {
    const scores = new Map<string, { entry: MemoryEntry; score: number; sources: Set<string>; ranks: number[] }>();

    miniLMResults.forEach((entry, idx) => {
      const id = entry.id;
      if (!scores.has(id)) scores.set(id, { entry, score: 0, sources: new Set(), ranks: [] });
      scores.get(id)!.score += 1 / (k + idx + 1);
      scores.get(id)!.sources.add("minilm");
      scores.get(id)!.ranks.push(idx + 1);
    });

    bgeResults.forEach((entry, idx) => {
      const id = entry.id;
      if (!scores.has(id)) scores.set(id, { entry, score: 0, sources: new Set(), ranks: [] });
      scores.get(id)!.score += 1 / (k + idx + 1);
      scores.get(id)!.sources.add("bge");
      scores.get(id)!.ranks.push(idx + 1);
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
  formatContextForInjection(searchResults: MemoryEntry[]): string {
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

export function generateSessionSummary(session: SessionState): string {
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

// Project search functionality using MCP client
let projectSearchClient: MemoryClient | null = null;

/**
 * Set the MCP client for project search
 */
export function setProjectSearchClient(client: MemoryClient): void {
  projectSearchClient = client;
}

/**
 * Search project files using semantic search
 */
export async function searchProjectFiles(query: string, topK: number = 10): Promise<{
  success: boolean;
  results?: ProjectSearchResult[];
  error?: string;
}> {
  if (!projectSearchClient) {
    // Try to initialize if not set
    try {
      projectSearchClient = await initializeMemoryClient();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  try {
    const result = await projectSearchClient.searchProject(query, topK);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Index the current project for searching
 */
export async function indexCurrentProject(rootPath: string): Promise<{
  success: boolean;
  filesIndexed?: number;
  error?: string;
}> {
  if (!projectSearchClient) {
    try {
      projectSearchClient = await initializeMemoryClient();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  try {
    const result = await projectSearchClient.indexProject(rootPath);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format project search results for injection into prompts
 */
export function formatProjectContextForInjection(results: ProjectSearchResult[]): string {
  if (results.length === 0) {
    return "";
  }
  let context = "\n\n## Relevant Project Files\n\n";
  for (const result of results) {
    const lines = result.lineEnd - result.lineStart > 0
      ? `${result.lineStart}-${result.lineEnd}`
      : "";
    context += `- **${result.filePath}**${lines ? ` (lines ${lines})` : ""}\n`;
    context += `  ${result.chunk.content.substring(0, 200)}${result.chunk.content.length > 200 ? "..." : ""}\n`;
  }
  context += "\n";
  return context;
}

export const boomerangMemory = new BoomerangMemory();
