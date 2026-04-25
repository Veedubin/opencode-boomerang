/**
 * End-to-end MCP integration tests
 * Tests: MemoryClient connecting to Super-Memory-TS MCP server
 * 
 * These tests verify that the MCP-only architecture works correctly:
 * - MemoryClient connects via stdio transport
 * - All 4 MCP tools work: query_memories, add_memory, search_project, index_project
 * - Error handling works
 */

import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { MemoryClient } from '../../src/memory-client';

// Mock the MCP SDK - use vi.hoisted for proper initialization
const { mockCallTool, mockConnect, mockClose } = vi.hoisted(() => ({
  mockCallTool: vi.fn(),
  mockConnect: vi.fn(),
  mockClose: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client', () => ({
  Client: class MockClient {
    connect = mockConnect;
    close = mockClose;
    callTool = mockCallTool;
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio', () => ({
  StdioClientTransport: class MockTransport {},
}));

describe('MCP Memory Integration', () => {
  let client: MemoryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    client = new MemoryClient();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  describe('Connection', () => {
    test('can connect to MCP server', async () => {
      await client.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(client.isConnected()).toBe(true);
    });

    test('handles connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));
      await expect(client.connect()).rejects.toThrow('Connection refused');
      expect(client.isConnected()).toBe(false);
    });

    test('can disconnect', async () => {
      await client.connect();
      await client.disconnect();
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('query_memories', () => {
    test('can query memories with default options', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify([
          { id: '1', content: 'Test memory', score: 0.95 },
        ]) }],
      });

      const results = await client.queryMemories('test query');
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'query_memories',
        arguments: {
          query: 'test query',
          limit: 10,
          strategy: 'tiered',
        },
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Test memory');
    });

    test('can query memories with custom options', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify([]) }],
      });

      await client.queryMemories('test', { limit: 5, strategy: 'vector_only' });
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'query_memories',
        arguments: {
          query: 'test',
          limit: 5,
          strategy: 'vector_only',
        },
      });
    });

    test('throws when not connected', async () => {
      await expect(client.queryMemories('test')).rejects.toThrow('Client not connected');
    });
  });

  describe('add_memory', () => {
    test('can add memory with content', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ id: 'mem-123' }) }],
      });

      const result = await client.addMemory({ content: 'Test memory' });
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'add_memory',
        arguments: {
          text: 'Test memory',
          metadata: {},
        },
      });
      
      expect(result.id).toBe('mem-123');
    });

    test('can add memory with metadata', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ id: 'mem-456' }) }],
      });

      await client.addMemory({
        content: 'Test with metadata',
        metadata: { project: 'test-project', tags: ['important'] },
      });
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'add_memory',
        arguments: {
          text: 'Test with metadata',
          metadata: { project: 'test-project', tags: ['important'] },
        },
      });
    });

    test('throws when not connected', async () => {
      await expect(client.addMemory({ content: 'test' })).rejects.toThrow('Client not connected');
    });
  });

  describe('search_project', () => {
    test('can search project files', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify({
          results: [
            { filePath: '/src/index.ts', content: 'const x = 1;', chunkIndex: 0 },
          ],
        }) }],
      });

      const results = await client.searchProject('find variable');
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'search_project',
        arguments: {
          query: 'find variable',
          topK: 20,
        },
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('/src/index.ts');
    });

    test('can search with custom topK', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      await client.searchProject('test', 10);
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'search_project',
        arguments: {
          query: 'test',
          topK: 10,
        },
      });
    });

    test('throws when not connected', async () => {
      await expect(client.searchProject('test')).rejects.toThrow('Client not connected');
    });
  });

  describe('index_project', () => {
    test('can index project', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ success: true }) }],
      });

      await client.indexProject('/test/project');
      
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'index_project',
        arguments: {
          rootPath: '/test/project',
        },
      });
    });

    test('throws when not connected', async () => {
      await expect(client.indexProject('/test')).rejects.toThrow('Client not connected');
    });
  });

  describe('Error Handling', () => {
    test('handles MCP tool errors gracefully', async () => {
      await client.connect();
      
      mockCallTool.mockRejectedValue(new Error('Database connection failed'));

      await expect(client.queryMemories('test')).rejects.toThrow('Database connection failed');
    });

    test('handles invalid JSON responses', async () => {
      await client.connect();
      
      mockCallTool.mockResolvedValue({
        content: [{ text: 'invalid json' }],
      });

      await expect(client.queryMemories('test')).rejects.toThrow();
    });
  });

  describe('Full Workflow', () => {
    test('complete workflow: add → query → search', async () => {
      await client.connect();
      
      // Step 1: Add memory
      mockCallTool.mockResolvedValueOnce({
        content: [{ text: JSON.stringify({ id: 'workflow-test' }) }],
      });
      
      const addResult = await client.addMemory({
        content: 'Important architectural decision: use MCP-only architecture',
        metadata: { project: 'boomerang-v2', type: 'decision' },
      });
      expect(addResult.id).toBe('workflow-test');

      // Step 2: Query memory
      mockCallTool.mockResolvedValueOnce({
        content: [{ text: JSON.stringify([
          { id: 'workflow-test', content: 'Important architectural decision: use MCP-only architecture', score: 0.98 },
        ]) }],
      });
      
      const queryResults = await client.queryMemories('architecture decision');
      expect(queryResults).toHaveLength(1);
      expect(queryResults[0].content).toContain('MCP-only');

      // Step 3: Search project
      mockCallTool.mockResolvedValueOnce({
        content: [{ text: JSON.stringify({
          results: [
            { filePath: '/src/memory-client.ts', content: 'export class MemoryClient', chunkIndex: 0 },
          ],
        }) }],
      });
      
      const projectResults = await client.searchProject('MemoryClient class');
      expect(projectResults).toHaveLength(1);
      expect(projectResults[0].filePath).toBe('/src/memory-client.ts');
    });
  });
});
