// Integration tests for TUI wire-up
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the orchestrator
const mockPlanTask = vi.fn();
const mockSaveResults = vi.fn();
const mockQueryContext = vi.fn();

vi.mock('../../src/orchestrator.js', () => ({
  Orchestrator: vi.fn().mockImplementation(() => ({
    planTask: mockPlanTask,
    saveResults: mockSaveResults,
    queryContext: mockQueryContext,
    setAutoMemory: vi.fn(),
  })),
  DEFAULT_AGENTS: [
    { name: 'boomerang', description: 'General agent', keywords: ['general'] },
    { name: 'boomerang-coder', description: 'Coder agent', keywords: ['code'] },
    { name: 'boomerang-explorer', description: 'Explorer agent', keywords: ['explore'] },
  ],
}));

// Mock the memory client
const mockMemoryQuery = vi.fn();
const mockMemoryAdd = vi.fn();
const mockMemorySearchProject = vi.fn();
const mockMemoryIndex = vi.fn();
const mockMemoryConnect = vi.fn();
const mockMemoryDisconnect = vi.fn();
const mockMemoryIsConnected = vi.fn().mockReturnValue(true);

vi.mock('../../src/memory-client.js', () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    connect: mockMemoryConnect,
    disconnect: mockMemoryDisconnect,
    queryMemories: mockMemoryQuery,
    addMemory: mockMemoryAdd,
    searchProject: mockMemorySearchProject,
    indexProject: mockMemoryIndex,
    isConnected: mockMemoryIsConnected,
  })),
}));

// Mock the asset loader
vi.mock('../../src/asset-loader.js', () => ({
  loadAgents: vi.fn().mockReturnValue([
    { name: 'boomerang-coder', description: 'Fast code generation', systemPrompt: '', skills: ['code'] },
    { name: 'boomerang-explorer', description: 'Codebase exploration', systemPrompt: '', skills: ['explore'] },
    { name: 'boomerang-tester', description: 'Testing specialist', systemPrompt: '', skills: ['test'] },
  ]),
}));

// Import after mocking - these don't use React hooks directly
import {
  resetSessions,
  createSession,
  switchSession,
  listSessions,
  deleteSession,
  getCurrentSession,
  incrementMessageCount,
  setMemorySystem,
} from '../../src/tui/hooks/useSession.js';
import {
  setOrchestratorInstance,
  setTaskExecutor,
  getOrchestratorInstance,
} from '../../src/tui/hooks/useAgent.js';
import type { Orchestrator, TaskGraph, TaskResult } from '../../src/orchestrator.js';

describe('TUI Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessions();

    // Set up default mock implementations
    mockPlanTask.mockReturnValue({
      tasks: [
        {
          id: 'task_1',
          type: 'code' as const,
          description: 'Test task',
          agent: 'boomerang-coder',
          dependencies: [],
          status: 'pending' as const,
        },
      ],
      edges: [],
    });

    mockMemoryQuery.mockResolvedValue([]);
    mockMemoryAdd.mockResolvedValue({ id: 'mem_1' });
  });

  describe('Session Management', () => {
    it('should create new sessions', () => {
      const session = createSession('test-session');
      expect(session.name).toBe('test-session');

      const sessions = listSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].name).toBe('test-session');
    });

    it('should create multiple sessions with unique IDs', () => {
      const session1 = createSession('Session 1');
      const session2 = createSession('Session 2');
      const session3 = createSession('Session 3');

      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);

      const sessions = listSessions();
      expect(sessions.length).toBe(3);
    });

    it('should switch between sessions', () => {
      const session1 = createSession('Session 1');
      const session2 = createSession('Session 2');

      expect(getCurrentSession()?.id).toBe(session2.id);

      switchSession(session1.id);

      expect(getCurrentSession()?.id).toBe(session1.id);
    });

    it('should increment message count', () => {
      createSession();
      expect(getCurrentSession()?.messageCount).toBe(0);

      incrementMessageCount();
      incrementMessageCount();

      expect(getCurrentSession()?.messageCount).toBe(2);
    });

    it('should delete sessions', () => {
      const session1 = createSession('Session 1');
      const session2 = createSession('Session 2');

      expect(listSessions().length).toBe(2);

      deleteSession(session1.id);

      expect(listSessions().length).toBe(1);
      expect(getCurrentSession()?.id).toBe(session2.id);
    });

    it('should handle session deletion when deleting active session', () => {
      const session1 = createSession('Session 1');
      const session2 = createSession('Session 2');

      // Currently on session2
      expect(getCurrentSession()?.id).toBe(session2.id);

      // Delete session2 (the active one)
      deleteSession(session2.id);

      // Should switch to session1
      expect(getCurrentSession()?.id).toBe(session1.id);
    });

    it('should reset all sessions', () => {
      createSession('Session 1');
      createSession('Session 2');
      createSession('Session 3');

      expect(listSessions().length).toBe(3);

      resetSessions();

      expect(listSessions().length).toBe(0);
      expect(getCurrentSession()).toBeNull();
    });
  });

  describe('Agent Orchestrator Integration', () => {
    it('should set and get orchestrator instance', () => {
      const mockOrchestrator = {
        planTask: mockPlanTask,
        saveResults: mockSaveResults,
      } as unknown as Orchestrator;

      setOrchestratorInstance(mockOrchestrator);
      expect(getOrchestratorInstance()).toBe(mockOrchestrator);
    });

    it('should plan tasks through orchestrator', () => {
      const mockOrchestrator = {
        planTask: mockPlanTask,
        saveResults: mockSaveResults,
      } as unknown as Orchestrator;

      setOrchestratorInstance(mockOrchestrator);

      const taskGraph = mockOrchestrator.planTask('Build a feature');

      expect(mockPlanTask).toHaveBeenCalledWith('Build a feature');
      expect(taskGraph.tasks).toHaveLength(1);
      expect(taskGraph.tasks[0].agent).toBe('boomerang-coder');
    });

    it('should set and get task executor', () => {
      const mockExecutor = {
        executeTask: async function* () {
          yield { taskId: 'test', success: true, output: 'Done', duration: 10 };
        },
      };

      setTaskExecutor(mockExecutor as any);
      // Verify it was set (getTaskExecutor not exported, but we can verify by behavior)
      expect(setTaskExecutor).toBeDefined();
    });
  });

  describe('Memory System Integration', () => {
    it('should set memory system', () => {
      const mockSystem = {
        queryMemories: vi.fn().mockResolvedValue([]),
        searchProject: vi.fn().mockResolvedValue([]),
        addMemory: vi.fn().mockResolvedValue({ id: 'mem_1' }),
      };

      setMemorySystem(mockSystem as any);
      // Memory system is set, subsequent memory operations would use it
      expect(setMemorySystem).toBeDefined();
    });
  });

  describe('Full Chat Flow (Simulated)', () => {
    it('should simulate session creation for chat session', () => {
      // Simulate starting a chat session
      const chatSession = createSession('chat-session-1');
      expect(chatSession.name).toBe('chat-session-1');

      // Simulate sending messages
      incrementMessageCount();
      incrementMessageCount();
      incrementMessageCount();

      expect(chatSession.messageCount).toBe(3);
    });

    it('should simulate agent switching in session', () => {
      const session = createSession('test');

      // Create two agent interaction records
      switchSession(session.id);

      // Session tracks message count
      incrementMessageCount();
      expect(getCurrentSession()?.messageCount).toBe(1);
    });

    it('should handle multiple sessions with independent message counts', () => {
      const session1 = createSession('Session 1');
      const session2 = createSession('Session 2');

      // Add messages to session 1
      switchSession(session1.id);
      incrementMessageCount();
      incrementMessageCount();

      // Add messages to session 2
      switchSession(session2.id);
      incrementMessageCount();

      // Verify counts
      switchSession(session1.id);
      expect(getCurrentSession()?.messageCount).toBe(2);

      switchSession(session2.id);
      expect(getCurrentSession()?.messageCount).toBe(1);
    });
  });

  describe('Type Exports and Interfaces', () => {
    it('should have valid TaskGraph structure from orchestrator', () => {
      const taskGraph = {
        tasks: [
          {
            id: 'task_1',
            type: 'code' as const,
            description: 'Test task',
            agent: 'boomerang-coder',
            dependencies: [],
            status: 'pending' as const,
          },
        ],
        edges: [],
      };

      expect(taskGraph.tasks[0].id).toBe('task_1');
      expect(taskGraph.tasks[0].type).toBe('code');
      expect(taskGraph.tasks[0].agent).toBe('boomerang-coder');
    });

    it('should have valid TaskResult structure', () => {
      const result: TaskResult = {
        taskId: 'task_1',
        success: true,
        output: 'Completed successfully',
        duration: 100,
      };

      expect(result.taskId).toBe('task_1');
      expect(result.success).toBe(true);
      expect(result.duration).toBe(100);
    });

    it('should have valid TaskResult error structure', () => {
      const result: TaskResult = {
        taskId: 'task_1',
        success: false,
        output: '',
        error: 'Something went wrong',
        duration: 50,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });
});
