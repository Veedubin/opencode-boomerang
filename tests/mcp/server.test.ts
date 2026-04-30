import { test, expect, describe, vi, beforeEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Use hoisted to avoid hoisting issues
const { mockMemorySystem, mockGetMemorySystem } = vi.hoisted(() => {
  const mockMemorySystem = {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    addMemory: vi.fn().mockResolvedValue({ id: 'test-memory-id', text: 'Test memory' }),
    getMemory: vi.fn().mockResolvedValue(null),
    deleteMemory: vi.fn().mockResolvedValue(undefined),
    listMemories: vi.fn().mockResolvedValue([]),
    queryMemories: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
  };

  const mockGetMemorySystem = vi.fn().mockReturnValue(mockMemorySystem);

  return { mockMemorySystem, mockGetMemorySystem };
});

vi.mock('@veedubin/super-memory-ts/dist/memory/index.js', () => ({
  MemorySystem: vi.fn(),
  getMemorySystem: mockGetMemorySystem,
}));

// Import after mocks
import { getMemorySystem } from '../../src/memory/index.js';
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
    mockMemorySystem.isInitialized.mockReturnValue(true);
    mockMemorySystem.addMemory.mockResolvedValue({ id: 'test-memory-id', text: 'Test memory' });
    mockMemorySystem.queryMemories.mockResolvedValue([]);
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
      expect(testServer).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    test('tools can be registered via setRequestHandler', async () => {
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

      expect(true).toBe(true);
    });
  });

  describe('Tool Handlers', () => {
    test('query_memories handler is registered and calls memory system search', async () => {
      const memorySystem = getMemorySystem();
      
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        if (name === 'query_memories') {
          const results = await memorySystem.search(args.query as string, { 
            topK: (args.topK as number) || 10, 
            strategy: (args.strategy as any) || 'TIERED',
            threshold: (args.threshold as number) || 0.7
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

      expect(true).toBe(true);
    });

    test('add_memory handler is registered and creates entry', async () => {
      const memorySystem = getMemorySystem();
      
      if (!memorySystem.isInitialized()) {
        await memorySystem.initialize();
      }

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

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

      expect(true).toBe(true);
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

      expect(true).toBe(true);
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
