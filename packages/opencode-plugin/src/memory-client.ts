/**
 * Memory Client - MCP Client for Super-Memory-TS
 * 
 * Uses StdioClientTransport to communicate with the Super-Memory-TS MCP server.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MemoryClientConfig, McpMemoryEntry, ProjectSearchResult, QueryResult, AddMemoryResult, SearchProjectResult, IndexProjectResult } from "./types.js";

/**
 * MemoryClient - Connects to Super-Memory-TS via MCP
 * 
 * Provides a typed interface to the memory and project indexing tools
 * exposed by the Super-Memory-TS MCP server.
 */
export class MemoryClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;
  private config: Required<MemoryClientConfig>;

  constructor(config?: MemoryClientConfig) {
    this.config = {
      serverCommand: config?.serverCommand || "bun",
      serverArgs: config?.serverArgs || ["run", "Super-Memory-TS/src/index.ts"],
      serverCwd: config?.serverCwd || process.cwd(),
      timeout: config?.timeout || 30000,
    };

    // Initialize MCP client
    this.client = new Client(
      {
        name: "boomerang-memory-client",
        version: "0.5.1",
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to the Super-Memory-TS MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const serverParams: StdioServerParameters = {
      command: this.config.serverCommand,
      args: this.config.serverArgs,
      cwd: this.config.serverCwd,
      env: process.env as Record<string, string>,
      stderr: "inherit",
    };

    this.transport = new StdioClientTransport(serverParams);

    try {
      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(
        `Failed to connect to Super-Memory-TS: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.transport) {
      return;
    }

    try {
      await this.transport.close();
    } catch (error) {
      // Ignore close errors
    }
    this.connected = false;
    this.transport = null;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Query memories using semantic search
   */
  async queryMemories(question: string, topK: number = 5): Promise<QueryResult> {
    if (!this.connected) {
      return { success: false, error: "Client not connected" };
    }

    try {
      const result = await this.client.callTool({
        name: "query_memories",
        arguments: { question, topK },
      });

      const contentArray = result.content as Array<{ type: string; text?: string }>;
      const content = contentArray?.[0];
      if (!content || content.type !== "text" || !content.text) {
        return { success: false, error: "Invalid response from server" };
      }

      const memories = JSON.parse(content.text) as McpMemoryEntry[];
      return { success: true, results: memories };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add a memory entry
   */
  async addMemory(
    text: string,
    sourceType: "session" | "file" | "web" | "boomerang" | "project" = "boomerang",
    metadata?: Record<string, string>
  ): Promise<AddMemoryResult> {
    if (!this.connected) {
      return { success: false, error: "Client not connected" };
    }

    try {
      const result = await this.client.callTool({
        name: "add_memory",
        arguments: {
          text,
          sourceType,
          metadata: metadata || {},
        },
      });

      const contentArray = result.content as Array<{ type: string; text?: string }>;
      const content = contentArray?.[0];
      if (!content || content.type !== "text" || !content.text) {
        return { success: false, error: "Invalid response from server" };
      }

      const response = JSON.parse(content.text) as { id: string };
      return { success: true, id: response.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search project files using semantic search
   */
  async searchProject(query: string, topK: number = 5): Promise<SearchProjectResult> {
    if (!this.connected) {
      return { success: false, error: "Client not connected" };
    }

    try {
      const result = await this.client.callTool({
        name: "search_project",
        arguments: { query, topK },
      });

      const contentArray = result.content as Array<{ type: string; text?: string }>;
      const content = contentArray?.[0];
      if (!content || content.type !== "text" || !content.text) {
        return { success: false, error: "Invalid response from server" };
      }

      const searchResults = JSON.parse(content.text) as ProjectSearchResult[];
      return { success: true, results: searchResults };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Index a project directory
   */
  async indexProject(rootPath: string): Promise<IndexProjectResult> {
    if (!this.connected) {
      return { success: false, error: "Client not connected" };
    }

    try {
      const result = await this.client.callTool({
        name: "index_project",
        arguments: { rootPath },
      });

      const contentArray = result.content as Array<{ type: string; text?: string }>;
      const content = contentArray?.[0];
      if (!content || content.type !== "text" || !content.text) {
        return { success: false, error: "Invalid response from server" };
      }

      const response = JSON.parse(content.text) as { filesIndexed: number };
      return { success: true, filesIndexed: response.filesIndexed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<string[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const result = await this.client.listTools();
      return result.tools.map((t) => t.name);
    } catch {
      return [];
    }
  }

  /**
   * Ping the server to check connectivity
   */
  async ping(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Default client instance
let defaultClient: MemoryClient | null = null;

/**
 * Get or create the default MemoryClient instance
 */
export function getMemoryClient(config?: MemoryClientConfig): MemoryClient {
  if (!defaultClient) {
    defaultClient = new MemoryClient(config);
  }
  return defaultClient;
}

/**
 * Initialize and connect the default MemoryClient
 */
export async function initializeMemoryClient(config?: MemoryClientConfig): Promise<MemoryClient> {
  const client = getMemoryClient(config);
  await client.connect();
  return client;
}

/**
 * Shutdown the default MemoryClient
 */
export async function shutdownMemoryClient(): Promise<void> {
  if (defaultClient) {
    await defaultClient.disconnect();
    defaultClient = null;
  }
}
