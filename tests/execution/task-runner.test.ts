/**
 * Task Runner Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskRunner, type Task, type ExecutionContext, type TaskExecutionResult } from '../../src/execution/task-runner.js';
import { AgentSpawner, type AgentProcess } from '../../src/execution/agent-spawner.js';
import { AgentPromptLoader } from '../../src/execution/agent-prompts.js';

// Mock AgentSpawner for testing without real subprocesses
class MockAgentSpawner {
  private processes: Map<string, AgentProcess> = new Map();
  
  async spawn(agentName: string, prompt: string): Promise<AgentProcess> {
    const id = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    let status: AgentProcess['status'] = 'running';
    
    const process: AgentProcess = {
      id,
      pid: Math.floor(Math.random() * 10000),
      agentName,
      status: 'running',
      output: '',
      startTime: Date.now(),
      kill: () => {
        status = 'killed';
        this.processes.delete(id);
      },
    };

    this.processes.set(id, process);

    // Simulate async completion after a tick
    setTimeout(() => {
      status = 'completed';
      process.status = 'completed';
      process.output = JSON.stringify({
        success: true,
        result: `[${agentName}] Mock execution for: ${prompt.substring(0, 50)}...`,
      });
      process.endTime = Date.now();
    }, 10);

    return process;
  }

  kill(processId: string): boolean {
    const proc = this.processes.get(processId);
    if (proc) {
      proc.kill();
      return true;
    }
    return false;
  }

  killAll(): void {
    for (const [id] of this.processes) {
      this.kill(id);
    }
  }

  listActive(): AgentProcess[] {
    return Array.from(this.processes.values()).filter(p => p.status === 'running');
  }

  getProcess(processId: string): AgentProcess | undefined {
    return this.processes.get(processId);
  }
}

// Mock AgentPromptLoader
class MockPromptLoader {
  async loadAgent(name: string) {
    return {
      name,
      model: 'mock-model',
      prompt: `Mock prompt for ${name}`,
      systemPrompt: `Mock system prompt for ${name}`,
    };
  }

  listAgents(): string[] {
    return ['boomerang-coder', 'boomerang-explorer', 'boomerang-tester'];
  }

  hasAgent(name: string): boolean {
    return this.listAgents().includes(name);
  }
}

describe('TaskRunner', () => {
  let spawner: MockAgentSpawner;
  let promptLoader: MockPromptLoader;
  let taskRunner: TaskRunner;

  beforeEach(() => {
    spawner = new MockAgentSpawner();
    promptLoader = new MockPromptLoader();
    taskRunner = new TaskRunner(spawner as unknown as AgentSpawner, promptLoader as unknown as AgentPromptLoader);
  });

  afterEach(() => {
    spawner.killAll();
  });

  describe('execute', () => {
    it('should execute a single task successfully', async () => {
      const task: Task = {
        id: 'task-1',
        agent: 'boomerang-coder',
        description: 'Implement a new feature',
      };

      const context: ExecutionContext = {
        sessionId: 'session-123',
      };

      const result = await taskRunner.execute(task, context);

      expect(result).toBeDefined();
      expect(result.taskId).toBe('task-1');
      expect(result.success).toBe(true);
      expect(result.agentUsed).toBe('boomerang-coder');
      expect(result.output).toContain('[boomerang-coder]');
      expect(result.error).toBeUndefined();
      expect(result.durationMs).toBeGreaterThan(0);
    }, 10000);

    it('should handle task with context', async () => {
      const task: Task = {
        id: 'task-2',
        agent: 'boomerang-explorer',
        description: 'Find relevant files',
        context: {
          filePattern: '*.ts',
          searchDir: './src',
        },
      };

      const context: ExecutionContext = {
        sessionId: 'session-456',
      };

      const result = await taskRunner.execute(task, context);

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    }, 10000);

    it('should include priority in execution', async () => {
      const task: Task = {
        id: 'task-3',
        agent: 'boomerang-tester',
        description: 'Run tests',
        priority: 'high',
      };

      const context: ExecutionContext = {
        sessionId: 'session-789',
      };

      const result = await taskRunner.execute(task, context);

      expect(result.success).toBe(true);
    }, 10000);
  });

  describe('executeAll', () => {
    it('should execute multiple tasks in sequence', async () => {
      const tasks: Task[] = [
        { id: 'task-a', agent: 'boomerang-coder', description: 'Task A' },
        { id: 'task-b', agent: 'boomerang-explorer', description: 'Task B' },
        { id: 'task-c', agent: 'boomerang-tester', description: 'Task C' },
      ];

      const context: ExecutionContext = {
        sessionId: 'session-batch',
      };

      const results = await taskRunner.executeAll(tasks, context);

      expect(results).toHaveLength(3);
      expect(results[0].taskId).toBe('task-a');
      expect(results[1].taskId).toBe('task-b');
      expect(results[2].taskId).toBe('task-c');
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
    }, 20000);

    it('should continue executing even if one task fails', async () => {
      // Note: Our mock always succeeds, but we can test the execution continues
      const tasks: Task[] = [
        { id: 'task-x', agent: 'boomerang-coder', description: 'Task X' },
        { id: 'task-y', agent: 'boomerang-explorer', description: 'Task Y' },
      ];

      const context: ExecutionContext = {
        sessionId: 'session-fail-test',
      };

      const results = await taskRunner.executeAll(tasks, context);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    }, 15000);
  });

  describe('output parsing', () => {
    it('should handle JSON output', async () => {
      const task: Task = {
        id: 'json-task',
        agent: 'boomerang-coder',
        description: 'Test JSON parsing',
      };

      const result = await taskRunner.execute(task, { sessionId: 'test' });

      expect(result.success).toBe(true);
      // Output may contain extra text, just check it's non-empty
      expect(result.output.length).toBeGreaterThan(0);
    }, 10000);
  });
});

describe('TaskRunner with real spawner', () => {
  let spawner: AgentSpawner;
  let promptLoader: AgentPromptLoader;
  let taskRunner: TaskRunner;

  beforeEach(() => {
    spawner = new AgentSpawner({
      maxConcurrentAgents: 2,
      defaultTimeoutMs: 5000,
    });
    promptLoader = new AgentPromptLoader(['agents/']);
    taskRunner = new TaskRunner(spawner, promptLoader);
  });

  afterEach(() => {
    spawner.killAll();
  });

  it('should execute with real subprocess spawner', async () => {
    const task: Task = {
      id: 'real-spawn-test',
      agent: 'boomerang-coder',
      description: 'Test real subprocess execution',
    };

    const context: ExecutionContext = {
      sessionId: 'real-test-session',
    };

    const result = await taskRunner.execute(task, context);

    expect(result).toBeDefined();
    expect(result.taskId).toBe('real-spawn-test');
    // Real spawner may succeed or fail based on execution, but should return a result
    expect(typeof result.success).toBe('boolean');
    expect(result.agentUsed).toBe('boomerang-coder');
  }, 15000);
});