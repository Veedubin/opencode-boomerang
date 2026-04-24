// MCP SDK client - use correct export paths
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

/**
 * Search result from memory query
 */
export interface SearchResult {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Project chunk from indexing
 */
export interface ProjectChunk {
  filePath: string;
  content: string;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Query options
 */
export interface QueryOptions {
  limit?: number;
  strategy?: 'tiered' | 'vector_only' | 'text_only';
}

/**
 * MCP client for memory operations
 */
export class MemoryClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxRetries = 3;

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Create transport for stdio communication
      // StdioClientTransport handles spawning the server process
      this.transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'src/server.ts']
      });

      // Create MCP client
      this.client = new Client({
        name: 'boomerang-memory-client',
        version: '2.0.0'
      }, {
        capabilities: {}
      });

      // Connect to the server
      await this.client.connect(this.transport);
      this.connected = true;
      this.reconnectAttempts = 0;

      console.log('Memory client connected');

    } catch (error) {
      console.error('Failed to connect memory client:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Handle disconnection and auto-reconnect
   */
  private async handleDisconnect(): Promise<void> {
    this.connected = false;

    if (this.reconnectAttempts < this.maxRetries) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxRetries})...`);

      // Clean up old resources
      this.transport = null;
      this.client = null;

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectAttempts));

      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnect failed:', error);
      }
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this.transport = null;
    this.connected = false;
    console.log('Memory client disconnected');
  }

  /**
   * Query memories from the memory system
   */
  async queryMemories(query: string, options: QueryOptions = {}): Promise<SearchResult[]> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.callTool({
        name: 'query_memories',
        arguments: {
          query,
          limit: options.limit || 10,
          strategy: options.strategy || 'tiered'
        }
      }) as { content: Array<{ text: string }> };

      return JSON.parse(result.content[0].text) as SearchResult[];
    } catch (error) {
      console.error('Error querying memories:', error);
      throw error;
    }
  }

  /**
   * Add a memory entry to the memory system
   */
  async addMemory(entry: { content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.callTool({
        name: 'add_memory',
        arguments: {
          text: entry.content,
          metadata: entry.metadata || {}
        }
      }) as { content: Array<{ text: string }> };

      return JSON.parse(result.content[0].text) as { id: string };
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  /**
   * Search project files for relevant content
   */
  async searchProject(query: string, topK: number = 20): Promise<ProjectChunk[]> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.callTool({
        name: 'search_project',
        arguments: {
          query,
          topK
        }
      }) as { content: Array<{ text: string }> };

      return JSON.parse(result.content[0].text).results as ProjectChunk[];
    } catch (error) {
      console.error('Error searching project:', error);
      throw error;
    }
  }

  /**
   * Index a project for searching
   */
  async indexProject(rootPath: string): Promise<void> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      await this.client.callTool({
        name: 'index_project',
        arguments: {
          rootPath
        }
      });
    } catch (error) {
      console.error('Error indexing project:', error);
      throw error;
    }
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
