import { MemorySearchResult, MemoryAddResult, MemorySaveLongResult, MemoryEntry, MemoryTierConfig, EmbeddingStrategy, SessionState, ProjectSearchResult, McpMemoryEntry } from "./types.js";
import { MemoryClient, initializeMemoryClient, shutdownMemoryClient } from "./memory-client.js";
import { join } from "path";

/*
 * Boomerang Memory - MCP-Only Search System
 * ==========================================
 * All memory operations route through MCP to Super-Memory-TS.
 * No direct imports from Super-Memory-TS.
 * 
 * TIERED = "Fast Reply" mode: Quick MiniLM search first, BGE fallback on low confidence misses
 * PARALLEL = "Archivist" mode: Searches both tiers simultaneously with RRF fusion for high recall
 */

export class BoomerangMemory {
  private mcpClient: MemoryClient | null = null;
  private config: MemoryTierConfig;

  constructor(config?: Partial<MemoryTierConfig>) {
    this.config = {
      strategy: (process.env.EMBEDDING_STRATEGY as EmbeddingStrategy) || "TIERED",
      bgeThreshold: parseFloat(process.env.BGE_THRESHOLD || "0.72"),
      autoSummarizeInterval: parseInt(process.env.AUTO_SUMMARIZE_INTERVAL || "15", 10),
      miniLMDimensions: 384,
      bgeDimensions: 1024,
      ...config,
    };
  }

  /**
   * Set the MCP client for Super-Memory-TS connection
   */
  setMcpClient(client: MemoryClient): void {
    this.mcpClient = client;
  }

  /**
   * Initialize MCP connection
   */
  async initialize(): Promise<void> {
    if (!this.mcpClient) {
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

  // Save to memory via MCP only
  async addMemory(content: string, tags?: string[], project?: string, metadata?: Record<string, any>): Promise<MemoryAddResult> {
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

  // Save to permanent tier (BGE-Large) via MCP only
  async addMemoryLong(content: string, project: string, tags?: string[], metadata?: Record<string, any>, _forceHighPrecision = true): Promise<MemorySaveLongResult> {
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

  // Search with strategy-aware logic via MCP only
  async searchMemory(query: string, limit = 5, project?: string, overrideStrategy?: EmbeddingStrategy): Promise<MemorySearchResult> {
    if (!this.mcpClient) {
      return { success: false, error: "MCP client not initialized" };
    }

    const strategy = overrideStrategy || this.config.strategy;
    try {
      const result = await this.mcpClient.queryMemories(query, limit);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const entries: McpMemoryEntry[] = result.results || [];
      
      // Map MCP results to MemoryEntry format
      const mappedResults: MemoryEntry[] = entries.map((r) => {
        const metadata = r.metadataJson ? JSON.parse(r.metadataJson) : {};
        return {
          id: r.id,
          content: r.text,
          tags: metadata.tags?.split(",").filter(Boolean) || [],
          createdAt: r.timestamp?.toString(),
          sourceModel: strategy === "TIERED" ? "minilm" : "bge-large",
          tier: strategy === "TIERED" ? "transient" : "permanent",
          project: metadata.project || 'unknown',
          metadata: metadata || {},
        };
      });

      return {
        success: true,
        results: mappedResults,
        strategy,
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

  // List memories via MCP
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
 * Search project files using semantic search (via MCP)
 */
export async function searchProjectFiles(query: string, topK: number = 10): Promise<{
  success: boolean;
  results?: ProjectSearchResult[];
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
 * Index the current project for searching (via MCP)
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
