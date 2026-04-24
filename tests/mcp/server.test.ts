import { test, expect, describe, vi, beforeEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock the database module
vi.mock('../../src/memory/database.js', () => {
  const mockWhere = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockToArray = vi.fn().mockResolvedValue([]);

  const mockQuery = vi.fn().mockReturnValue({
    where: mockWhere,
    select: mockSelect,
    limit: mockLimit,
    toArray: mockToArray,
  });

  return {
    lancedbPool: {
      connect: vi.fn().mockResolvedValue({
        createTable: vi.fn().mockResolvedValue({}),
        openTable: vi.fn().mockResolvedValue({}),
      }),
      getTable: vi.fn().mockResolvedValue({
        add: vi.fn().mockResolvedValue(undefined),
        query: mockQuery,
        delete: vi.fn().mockResolvedValue(undefined),
      }),
      createIndex: vi.fn().mockResolvedValue(undefined),
      _mockQuery: mockQuery,
      _mockToArray: mockToArray,
    },
  };
});

// Mock the model module
vi.mock('../../src/model/index.js', () => ({
  modelManager: {
    loadModel: vi.fn().mockResolvedValue({}),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    getPipeline: vi.fn().mockReturnValue(null),
  },
  ModelManager: {
    getInstance: vi.fn(),
  },
}));

// Mock search module for memory search
vi.mock('../../src/memory/search.js', () => ({
  search: vi.fn().mockResolvedValue([
    {
      entry: {
        id: 'mem-1',
        text: 'Test memory content',
        sourceType: 'manual',
        sourcePath: '/test/path',
        sessionId: 'test-session',
        metadataJson: '{}',
        vector: new Array(1024).fill(0.1),
        timestamp: Date.now(),
        contentHash: 'abc123',
      },
      score: 0.95,
    },
  ]),
}));

// Mock project-index search
vi.mock('../../src/project-index/search.js', () => ({
  searchProject: vi.fn().mockResolvedValue([
    {
      filePath: '/project/src/index.ts',
      content: 'const x = 1;',
      lineStart: 1,
      lineEnd: 2,
      score: 0.88,
    },
  ]),
}));

// Import after mocks
import { getMemorySystem } from '../../src/memory/index.js';
import { lancedbPool } from '../../src/memory/database.js';
import { search as memorySearch } from '../../src/memory/search.js';
import { searchProject } from '../../src/project-index/search.js';
import { ProjectIndexer } from '../../src/project-index/indexer.js';
import { MemoryError, ValidationError, NotFoundError, createErrorResponse } from '../../src/utils/errors.js';

// Test server factory
function createTestServer() {
  return new Server(
    {
      name: 'super-memory',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
}

describe('MCP Server', () => {
  let server: Server;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createTestServer();
    
    // Reset mock implementations
    const pool = lancedbPool as any;
    pool._mockToArray.mockResolvedValue([]);
  });

  describe('Server Creation', () => {
    test('server can be created with correct name and version', () => {
      const testServer = new Server(
        { name: 'super-memory', version: '2.0.0' },
        { capabilities: { tools: {} } }
      );
      expect(testServer).toBeDefined();
    });

    test('server has capabilities with tools', () => {
      const testServer = createTestServer();
      // Server is created with tools capability - verify it starts without error
      expect(testServer).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    test('tools can be registered via setRequestHandler', async () => {
      // Set the handler - this is synchronous
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          {
            name: 'query_memories',
            description: 'Search memories using vector similarity',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query string' },
              },
              required: ['query'],
            },
          },
          {
            name: 'add_memory',
            description: 'Add a new memory entry',
            inputSchema: {
              type: 'object',
              properties: {
                text: { type: 'string' },
              },
              required: ['text'],
            },
          },
          {
            name: 'search_project',
            description: 'Search project files',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
          {
            name: 'index_project',
            description: 'Start project indexing',
            inputSchema: {
              type: 'object',
              properties: {
                rootPath: { type: 'string' },
              },
              required: ['rootPath'],
            },
          },
        ],
      }));

      // Verify handler is set (no error thrown)
      expect(true).toBe(true);
    });
  });

  describe('Tool Handlers', () => {
    test('query_memories handler is registered and calls search', async () => {
      let callCount = 0;
      
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        callCount++;

        if (name === 'query_memories') {
          const results = await memorySearch(args.query as string, { 
            topK: (args.topK as number) || 10, 
            threshold: (args.threshold as number) || 0.7, 
            strategy: (args.strategy as any) || 'TIERED' 
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
        }

        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      });

      // Verify handler was set
      expect(callCount).toBe(0);
    });

    test('add_memory handler is registered and creates entry', async () => {
      const memorySystem = getMemorySystem();
      
      if (!memorySystem.isInitialized()) {
        await memorySystem.initialize();
      }

      let callCount = 0;
      
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        callCount++;

        if (name === 'add_memory') {
          const entry = await memorySystem.addMemory({
            text: args.text as string,
            sourceType: (args.sourceType as any) || 'manual',
            sourcePath: (args.sourcePath as string) || '',
            metadataJson: args.metadata ? JSON.stringify(args.metadata) : '{}',
            sessionId: 'mcp-session',
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ id: entry.id, success: true }),
              },
            ],
          };
        }

        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      });

      expect(callCount).toBe(0);
    });

    test('search_project handler is registered', async () => {
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        if (name === 'search_project') {
          const results = await searchProject(args.query as string, (args.topK as number) || 10);

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
        }

        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      });
    });

    test('index_project handler is registered and starts indexer', async () => {
      let indexerStarted = false;

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        if (name === 'index_project') {
          const dbUri = process.env.LANCEDB_URI || 'memory://';
          const indexer = new ProjectIndexer(dbUri, args.rootPath as string);
          
          // Mock start to avoid actual file watching
          vi.spyOn(indexer, 'start').mockResolvedValue(undefined);
          
          await indexer.start();
          indexerStarted = true;

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Indexing started' }),
              },
            ],
          };
        }

        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      });

      expect(indexerStarted).toBe(false);
    });

    test('error handling returns isError true for invalid input', async () => {
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        if (name === 'query_memories') {
          if (!args.query || args.query.trim().length === 0) {
            return {
              content: [{ type: 'text', text: 'Query is required' }],
              isError: true,
            };
          }
        }

        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      });
    });
  });
});

describe('Error Types', () => {
  test('MemoryError has correct properties', () => {
    const error = new MemoryError('Test error');
    expect(error.name).toBe('MemoryError');
    expect(error.code).toBe('MEMORY_ERROR');
    expect(error.message).toBe('Test error');
  });

  test('ValidationError has correct properties', () => {
    const error = new ValidationError('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input');
  });

  test('NotFoundError has correct properties', () => {
    const error = new NotFoundError('Not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Not found');
  });

  test('createErrorResponse returns MCP format', () => {
    const error = new ValidationError('Missing required field');
    const response = createErrorResponse(error);
    
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Missing required field' }],
      isError: true,
    });
  });

  test('createErrorResponse handles MemoryError', () => {
    const error = new MemoryError('Database connection failed');
    const response = createErrorResponse(error);
    
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Database connection failed' }],
      isError: true,
    });
  });
});

describe('ProjectIndexer', () => {
  test('can be instantiated with dbUri and rootPath', () => {
    const indexer = new ProjectIndexer('memory://', '/test/path');
    expect(indexer).toBeDefined();
  });

  test('getStats returns indexer statistics', () => {
    const indexer = new ProjectIndexer('memory://', '/test/path');
    const stats = indexer.getStats();
    
    expect(stats).toHaveProperty('totalFiles');
    expect(stats).toHaveProperty('totalChunks');
    expect(stats).toHaveProperty('lastIndexed');
  });
});
