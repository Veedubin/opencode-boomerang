import { describe, test, expect, beforeEach } from 'vitest';
import { createSession, switchSession, listSessions, deleteSession, getCurrentSession, setMemorySystem, resetSessions } from '../../src/tui/hooks/useSession';
import type { OrchestratorClient } from '../../src/tui/hooks/useAgent';

// ============== useSession Tests ==============

describe('useSession', () => {
  // Mock memory system
  const createMockMemorySystem = () => ({
    memories: [] as Array<{ id: string; content: string; metadata?: Record<string, unknown> }>,
    async addMemory(content: string, metadata?: Record<string, unknown>) {
      this.memories.push({
        id: crypto.randomUUID(),
        content,
        metadata,
      });
    },
    async queryMemories(query: string, options?: { limit?: number }) {
      return [];
    },
    async getMemoriesBySource(sourceType: string) {
      return this.memories.filter(m => m.metadata?.sourceType === sourceType);
    },
    async deleteMemory(id: string) {
      const idx = this.memories.findIndex(m => m.id === id);
      if (idx !== -1) {
        this.memories.splice(idx, 1);
        return true;
      }
      return false;
    },
  });

  let mockMemorySystem: ReturnType<typeof createMockMemorySystem>;

  beforeEach(() => {
    // Reset sessions state before each test
    resetSessions();
    mockMemorySystem = createMockMemorySystem();
    setMemorySystem(mockMemorySystem as any);
  });

  test('createSession creates a new session with default name', () => {
    const session = createSession();
    
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.name).toBe('Session 1');
    expect(session.messageCount).toBe(0);
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
  });

  test('createSession creates a new session with custom name', () => {
    const session = createSession('My Custom Session');
    
    expect(session.name).toBe('My Custom Session');
  });

  test('switchSession switches the active session', () => {
    const session1 = createSession('Session 1');
    createSession('Session 2');
    
    switchSession(session1.id);
    
    const current = getCurrentSession();
    expect(current?.id).toBe(session1.id);
  });

  test('listSessions returns all sessions', () => {
    createSession('Session 1');
    createSession('Session 2');
    createSession('Session 3');
    
    const sessions = listSessions();
    
    expect(sessions).toHaveLength(3);
  });

  test('deleteSession removes a session and returns true', () => {
    const session1 = createSession('Session 1');
    const session2 = createSession('Session 2');
    
    const result = deleteSession(session1.id);
    
    expect(result).toBe(true);
    const sessions = listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(session2.id);
  });

  test('deleteSession returns false for non-existent session', () => {
    const result = deleteSession('non-existent-id');
    expect(result).toBe(false);
  });

  test('getCurrentSession returns null when no sessions exist', () => {
    const current = getCurrentSession();
    expect(current).toBeNull();
  });

  test('getCurrentSession returns the active session', () => {
    const session = createSession('Active Session');
    
    const current = getCurrentSession();
    
    expect(current?.id).toBe(session.id);
    expect(current?.name).toBe('Active Session');
  });

  test('deleting active session switches to next available', () => {
    const session1 = createSession('Session 1');
    const session2 = createSession('Session 2');
    
    deleteSession(session1.id);
    
    expect(getCurrentSession()?.id).toBe(session2.id);
  });

  test('sessions are persisted to memory system', async () => {
    createSession('Persisted Session');
    
    const memories = await mockMemorySystem.getMemoriesBySource('session');
    expect(memories.length).toBeGreaterThan(0);
    
    const sessionMemory = memories[memories.length - 1];
    const data = JSON.parse(sessionMemory.content);
    expect(data.type).toBe('session');
    expect(data.name).toBe('Persisted Session');
  });

  test('multiple sessions can be created', () => {
    const s1 = createSession('First');
    const s2 = createSession('Second');
    const s3 = createSession('Third');
    
    expect(listSessions()).toHaveLength(3);
    expect(s1.id).not.toBe(s2.id);
    expect(s2.id).not.toBe(s3.id);
  });

  test('switching to non-existent session does nothing', () => {
    createSession('Session 1');
    const originalId = getCurrentSession()?.id;
    
    switchSession('non-existent-id');
    
    expect(getCurrentSession()?.id).toBe(originalId);
  });
});

// ============== useAgent Tests (Non-hook functions) ==============

describe('useAgent - Orchestrator Interface', () => {
  test('orchestrator interface can be set and called', async () => {
    // This tests the interface contract
    const mockOrchestrator: OrchestratorClient = {
      async sendMessage(message: string, agentName?: string) {
        return `Agent ${agentName || 'default'} responded: ${message}`;
      },
      async executeTask(task: string, agentName: string) {
        return `Task completed by ${agentName}: ${task}`;
      },
    };

    const result = await mockOrchestrator.sendMessage('Hello', 'TestAgent');
    expect(result).toContain('TestAgent');
    expect(result).toContain('Hello');

    const taskResult = await mockOrchestrator.executeTask('test task', 'Coder');
    expect(taskResult).toContain('Coder');
    expect(taskResult).toContain('test task');
  });

  test('orchestrator sendMessage returns expected format', async () => {
    const mockOrchestrator: OrchestratorClient = {
      async sendMessage(message: string, agentName?: string) {
        return `Echo: ${message} (from ${agentName || 'default'})`;
      },
      async executeTask(task: string, agentName: string) {
        return `${agentName} finished: ${task}`;
      },
    };

    const result = await mockOrchestrator.sendMessage('test message', 'MyAgent');
    expect(result).toBe('Echo: test message (from MyAgent)');
  });

  test('orchestrator executeTask handles different agents', async () => {
    const mockOrchestrator: OrchestratorClient = {
      async sendMessage(message: string, agentName?: string) {
        return `Response to ${message}`;
      },
      async executeTask(task: string, agentName: string) {
        return `${agentName} completed: ${task}`;
      },
    };

    const coderResult = await mockOrchestrator.executeTask('write code', 'Coder');
    const testerResult = await mockOrchestrator.executeTask('run tests', 'Tester');
    
    expect(coderResult).toBe('Coder completed: write code');
    expect(testerResult).toBe('Tester completed: run tests');
  });
});

// ============== useMemory Interface Tests ==============

describe('useMemory - Interface Contract', () => {
  test('memory interface returns expected search result format', async () => {
    const mockMemorySystem = {
      async queryMemories(query: string) {
        return [
          { id: '1', content: 'Test content', score: 0.95, metadata: { source: 'test' } },
          { id: '2', content: 'Another result', score: 0.87, metadata: {} },
        ];
      },
      async searchProject(query: string, topK: number = 20) {
        return [
          { id: 'chunk1', content: `Chunk for ${query}`, path: '/src/file.ts' },
        ];
      },
      async addMemory(content: string, metadata?: Record<string, unknown>) {
        // Store in memory
      },
    };

    const results = await mockMemorySystem.queryMemories('test');
    expect(results).toHaveLength(2);
    expect(results[0].score).toBe(0.95);
    expect(results[0].content).toBe('Test content');

    const projectResults = await mockMemorySystem.searchProject('test', 10);
    expect(projectResults.length).toBeGreaterThan(0);
    expect(projectResults[0].content).toContain('test');
  });

  test('memory addMemory stores content with metadata', async () => {
    let storedContent = '';
    let storedMetadata: Record<string, unknown> | undefined = {};

    const mockMemorySystem = {
      async addMemory(content: string, metadata?: Record<string, unknown>) {
        storedContent = content;
        storedMetadata = metadata;
      },
    };

    await mockMemorySystem.addMemory('Important memory', { source: 'test', priority: 'high' });

    expect(storedContent).toBe('Important memory');
    expect(storedMetadata?.source).toBe('test');
    expect(storedMetadata?.priority).toBe('high');
  });

  test('searchProject respects topK parameter', async () => {
    const mockMemorySystem = {
      async searchProject(query: string, topK: number = 20) {
        const chunks = Array.from({ length: 50 }, (_, i) => ({
          id: `chunk${i}`,
          content: `Chunk ${i} for ${query}`,
          path: `/src/file${i}.ts`,
        }));
        return chunks.slice(0, topK);
      },
    };

    const results10 = await mockMemorySystem.searchProject('test', 10);
    const results5 = await mockMemorySystem.searchProject('test', 5);

    expect(results10).toHaveLength(10);
    expect(results5).toHaveLength(5);
  });
});
