/**
 * Native Memory - MCP Client Wrapper for Boomerang
 * 
 * This module provides native memory operations via MCP to Super-Memory-TS.
 * No direct imports from Super-Memory-TS. All memory operations go through MCP.
 */

import { MemoryClient, getMemoryClient } from './memory-client.js';

export class NativeBoomerangMemory {
  private client: MemoryClient;

  constructor(client?: MemoryClient) {
    this.client = client || getMemoryClient();
  }

  /**
   * Add a memory entry via MCP
   */
  async addMemory(content: string, tags?: string[], metadata?: Record<string, any>): Promise<any> {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    return this.client.addMemory(content, 'boomerang', {
      ...metadata,
      tags: tags?.join(',') || '',
    });
  }

  /**
   * Search memories via MCP
   */
  async searchMemory(query: string, limit = 5): Promise<any> {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    return this.client.queryMemories(query, limit);
  }

  /**
   * Index a project via MCP
   */
  async indexProject(rootPath: string): Promise<any> {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    return this.client.indexProject(rootPath);
  }
}

export const boomerangMemory = new NativeBoomerangMemory();