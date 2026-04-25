/**
 * Built-in Memory - MCP Client Wrapper for Boomerang
 * 
 * This module provides a compatible interface for Boomerang memory operations
 * but routes ALL operations through MCP to the Super-Memory-TS server.
 * 
 * No direct imports from Super-Memory-TS. All memory operations go through MCP.
 */

import { MemoryClient, getMemoryClient } from './memory-client.js';

export interface ProjectMemoryConfig {
  memoryPath: string;
  indexPath: string;
  excludePatterns: string[];
  chunkSize: number;
  chunkOverlap?: number;
  maxFileSize?: number;
}

/**
 * Status of the memory system
 */
export interface BuiltInMemoryStatus {
  indexedFiles: number;
  totalChunks: number;
  status: 'initializing' | 'running' | 'stopped' | 'error';
  modelLoaded: boolean;
  modelId?: string;
  error?: string;
}

/**
 * BuiltInMemory - MCP Client Wrapper
 * 
 * Provides the same interface as the original built-in memory but routes
 * all operations through MCP to the Super-Memory-TS server.
 * 
 * This maintains API compatibility while using MCP exclusively.
 */
export class BuiltInMemory {
  private client: MemoryClient | null = null;
  private projectPath: string = '';
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the memory system for a specific project via MCP
   */
  async initialize(projectPath: string, _config?: ProjectMemoryConfig): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.projectPath = projectPath;

    this.initPromise = (async () => {
      try {
        // Get or create MCP client
        this.client = getMemoryClient();
        
        // Connect if not already connected
        if (!this.client.isConnected()) {
          await this.client.connect();
        }

        // Index the project via MCP
        try {
          await this.client.indexProject(projectPath);
        } catch (err) {
          // Indexing may fail if server doesn't support it, continue anyway
          console.log('Project indexing via MCP:', err instanceof Error ? err.message : String(err));
        }

        this.initialized = true;
        console.log(`BuiltInMemory (MCP wrapper) initialized for project: ${projectPath}`);
      } catch (error) {
        console.error('Failed to initialize BuiltInMemory (MCP wrapper):', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Search project files using semantic search (via MCP)
   */
  async searchProject(query: string, topK: number = 10): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    const result = await this.client.searchProject(query, topK);
    if (!result.success) {
      return [];
    }
    return result.results || [];
  }

  /**
   * Query memories from the database (via MCP)
   */
  async queryMemories(query: string, topK: number = 5): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    const result = await this.client.queryMemories(query, topK);
    if (!result.success) {
      return [];
    }
    return result.results || [];
  }

  /**
   * Add a memory entry (via MCP)
   */
  async addMemory(content: string, metadata?: Record<string, string>): Promise<string> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    const result = await this.client.addMemory(content, 'boomerang', metadata);
    if (!result.success) {
      throw new Error(result.error || 'Failed to add memory');
    }
    return result.id || '';
  }

  /**
   * Get current status of the memory system (via MCP ping)
   */
  getStatus(): BuiltInMemoryStatus {
    return {
      indexedFiles: 0, // MCP doesn't expose detailed stats
      totalChunks: 0,
      status: this.initialized ? 'running' : 'initializing',
      modelLoaded: this.client?.isConnected() ?? false,
      modelId: 'mcp-server',
    };
  }

  /**
   * Get the project path this memory instance is for
   */
  getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Disconnect from MCP server
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    this.initialized = false;
    this.initPromise = null;
    this.projectPath = '';
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
