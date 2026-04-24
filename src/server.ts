/**
 * Super Memory MCP Server
 * Provides tools for memory operations and project indexing
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getMemorySystem, MemorySystem } from './memory/index.js';
import { search as memorySearch } from './memory/search.js';
import { searchProject } from './project-index/search.js';
import { ProjectIndexer } from './project-index/indexer.js';
import { MemoryError, ValidationError, NotFoundError, createErrorResponse } from './utils/errors.js';

// Server configuration
const SERVER_NAME = 'super-memory';
const SERVER_VERSION = '2.0.0';

// Track active indexer instance
let activeIndexer: ProjectIndexer | null = null;

// Connection state
let transport: StdioServerTransport | null = null;

/**
 * Initialize and start the MCP server
 */
async function main() {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'query_memories',
        description: 'Search memories using vector similarity and optional text fallback',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query string' },
            strategy: {
              type: 'string',
              enum: ['TIERED', 'VECTOR_ONLY', 'TEXT_ONLY'],
              description: 'Search strategy (default: TIERED)',
            },
            topK: { type: 'number', description: 'Maximum results to return (default: 10)' },
            threshold: { type: 'number', description: 'Minimum score threshold (default: 0.7)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'add_memory',
        description: 'Add a new memory entry to the system',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Memory text content' },
            sourceType: {
              type: 'string',
              enum: ['file', 'conversation', 'manual', 'web'],
              description: 'Source type (default: manual)',
            },
            sourcePath: { type: 'string', description: 'Source path or identifier' },
            metadata: { type: 'object', description: 'Optional metadata' },
          },
          required: ['text'],
        },
      },
      {
        name: 'search_project',
        description: 'Search project files for relevant code chunks',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query string' },
            topK: { type: 'number', description: 'Maximum results to return (default: 10)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'index_project',
        description: 'Start indexing a project directory',
        inputSchema: {
          type: 'object',
          properties: {
            rootPath: { type: 'string', description: 'Root path of project to index' },
          },
          required: ['rootPath'],
        },
      },
    ],
  }));

  // Tool handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Check transport state
    if (!transport || !isTransportConnected()) {
      return createErrorResponse(new MemoryError('Server transport not connected'));
    }

    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'query_memories':
          return handleQueryMemories(args);
        case 'add_memory':
          return handleAddMemory(args);
        case 'search_project':
          return handleSearchProject(args);
        case 'index_project':
          return handleIndexProject(args);
        default:
          return createErrorResponse(new ValidationError(`Unknown tool: ${name}`));
      }
    } catch (err) {
      console.error('Tool handler error:', err);
      if (err instanceof ValidationError || err instanceof NotFoundError) {
        return createErrorResponse(err);
      }
      return createErrorResponse(new MemoryError(err instanceof Error ? err.message : 'Unknown error', err));
    }
  });

  // Initialize transport
  transport = new StdioServerTransport();
  
  // Connect and run
  await server.connect(transport);
  console.error(`[super-memory] MCP Server started (${SERVER_VERSION})`);
}

/**
 * Check if transport is connected
 */
function isTransportConnected(): boolean {
  // StdioServerTransport doesn't expose a direct connected state,
  // but we can track it through our own flag
  return transport !== null;
}

// Tool input schemas
const queryMemoriesSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  strategy: z.enum(['TIERED', 'VECTOR_ONLY', 'TEXT_ONLY']).optional(),
  topK: z.number().positive().optional(),
  threshold: z.number().min(0).max(1).optional(),
});

const addMemorySchema = z.object({
  text: z.string().min(1, 'Text is required'),
  sourceType: z.enum(['file', 'conversation', 'manual', 'web']).optional(),
  sourcePath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const searchProjectSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  topK: z.number().positive().optional(),
});

const indexProjectSchema = z.object({
  rootPath: z.string().min(1, 'Root path is required'),
});

/**
 * Tool: query_memories - Search memories
 */
async function handleQueryMemories(args: unknown) {
  const parsed = queryMemoriesSchema.safeParse(args);
  if (!parsed.success) {
    return createErrorResponse(new ValidationError(parsed.error.message));
  }

  const { query, strategy, topK = 10, threshold = 0.7 } = parsed.data;

  try {
    const memorySystem = getMemorySystem();
    await memorySystem.initialize();

    // Use the search function from memory/search.ts
    const results = await memorySearch(query, {
      strategy: strategy as 'TIERED' | 'VECTOR_ONLY' | 'TEXT_ONLY' | undefined,
      topK,
      threshold,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            results: results.map((r) => ({
              text: r.entry.text,
              score: r.score,
              sourceType: r.entry.sourceType,
              sourcePath: r.entry.sourcePath,
            })),
          }),
        },
      ],
    };
  } catch (err) {
    console.error('query_memories error:', err);
    return createErrorResponse(new MemoryError(err instanceof Error ? err.message : 'Search failed', err));
  }
}

/**
 * Tool: add_memory - Add a memory entry
 */
async function handleAddMemory(args: unknown) {
  const parsed = addMemorySchema.safeParse(args);
  if (!parsed.success) {
    return createErrorResponse(new ValidationError(parsed.error.message));
  }

  const { text, sourceType = 'manual', sourcePath = '', metadata } = parsed.data;

  try {
    const memorySystem = getMemorySystem();
    await memorySystem.initialize();

    const entry = await memorySystem.addMemory({
      text,
      sourceType: sourceType as 'file' | 'conversation' | 'manual' | 'web',
      sourcePath,
      sessionId: 'mcp-session',
      metadataJson: metadata ? JSON.stringify(metadata) : '{}',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ id: entry.id, success: true }),
        },
      ],
    };
  } catch (err) {
    console.error('add_memory error:', err);
    return createErrorResponse(new MemoryError(err instanceof Error ? err.message : 'Add memory failed', err));
  }
}

/**
 * Tool: search_project - Search project chunks
 */
async function handleSearchProject(args: unknown) {
  const parsed = searchProjectSchema.safeParse(args);
  if (!parsed.success) {
    return createErrorResponse(new ValidationError(parsed.error.message));
  }

  const { query, topK = 10 } = parsed.data;

  try {
    const results = await searchProject(query, topK);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            results: results.map((r) => ({
              filePath: r.filePath,
              lineStart: r.lineStart,
              lineEnd: r.lineEnd,
              content: r.content,
              score: r.score,
            })),
          }),
        },
      ],
    };
  } catch (err) {
    console.error('search_project error:', err);
    return createErrorResponse(new MemoryError(err instanceof Error ? err.message : 'Project search failed', err));
  }
}

/**
 * Tool: index_project - Start project indexing
 */
async function handleIndexProject(args: unknown) {
  const parsed = indexProjectSchema.safeParse(args);
  if (!parsed.success) {
    return createErrorResponse(new ValidationError(parsed.error.message));
  }

  const { rootPath } = parsed.data;

  try {
    // Get db URI from environment or use default
    const dbUri = process.env.LANCEDB_URI || 'memory://';

    // Create new indexer
    const indexer = new ProjectIndexer(dbUri, rootPath);
    
    // Start indexing
    await indexer.start();
    
    // Store reference to keep it alive
    activeIndexer = indexer;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, message: 'Indexing started' }),
        },
      ],
    };
  } catch (err) {
    console.error('index_project error:', err);
    return createErrorResponse(new MemoryError(err instanceof Error ? err.message : 'Indexing failed', err));
  }
}

// Run server
main().catch((err) => {
  console.error('Server fatal error:', err);
  process.exit(1);
});
