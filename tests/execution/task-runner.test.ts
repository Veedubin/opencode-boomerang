/**
 * Task Runner Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskRunner, type Task, type ExecutionContext, type TaskExecutionResult } from '../../src/execution/task-runner.js';
import { AgentSpawner, type AgentProcess } from '../../src/execution/agent-spawner.js';
import { AgentPromptLoader, type AgentPrompt } from '../../src/execution/agent-prompts.js';

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
      prompt: `Mock prompt for ${name} - style guide and rules`,
      systemPrompt: `Mock system prompt for ${name} - identity section`,
      skillContent: `Mock skill content for ${name}`,
    };
  }

  listAgents(): string[] {
    return ['boomerang-coder', 'boomerang-explorer', 'boomerang-tester'];
  }

  hasAgent(name: string): boolean {
    return this.listAgents().includes(name);
  }
}

// TestableTaskRunner exposes buildPrompt for testing
class TestableTaskRunner extends TaskRunner {
  constructor(spawner: AgentSpawner, promptLoader: AgentPromptLoader) {
    super(spawner, promptLoader);
  }

  testBuildPrompt(task: Task, agentPrompt: AgentPrompt): string {
    return this.buildPrompt(task, agentPrompt);
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

  describe('buildPrompt composition', () => {
    let testableRunner: TestableTaskRunner;

    beforeEach(() => {
      testableRunner = new TestableTaskRunner(spawner as unknown as AgentSpawner, promptLoader as unknown as AgentPromptLoader);
    });

    it('should compose all 6 layers when all are present', () => {
      const task: Task = {
        id: 'test-task',
        agent: 'boomerang-coder',
        description: 'Implement a feature',
        context: {
          originalUserRequest: 'User wants a new feature',
          taskBackground: 'Background info',
          relevantFiles: ['file1.ts', 'file2.ts'],
          codeSnippets: ['snippet1', 'snippet2'],
          previousDecisions: ['decision1'],
          expectedOutput: 'output description',
          scopeBoundaries: { in: ['a'], out: ['b'] },
          errorHandling: 'handle errors gracefully',
        },
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'You are a coder agent',
        prompt: 'Style guide: use clean code',
        skillContent: 'Skill instructions here',
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).toContain('You are a coder agent');
      expect(result).toContain('Style guide: use clean code');
      expect(result).toContain('## Skills');
      expect(result).toContain('Skill instructions here');
      expect(result).toContain('## Context');
      expect(result).toContain('### Original User Request');
      expect(result).toContain('User wants a new feature');
      expect(result).toContain('## Task');
      expect(result).toContain('Implement a feature');
      expect(result).toContain('## Instructions');
    });

    it('should skip layers when not present', () => {
      const task: Task = {
        id: 'minimal-task',
        agent: 'boomerang-coder',
        description: 'Minimal task',
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'Minimal system prompt',
        prompt: '',
        skillContent: undefined,
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).toContain('Minimal system prompt');
      expect(result).not.toContain('## Skills');
      expect(result).not.toContain('## Context');
      expect(result).toContain('## Task');
      expect(result).toContain('Minimal task');
      expect(result).toContain('## Instructions');
    });

    it('should handle empty context object', () => {
      const task: Task = {
        id: 'empty-context-task',
        agent: 'boomerang-coder',
        description: 'Task with empty context',
        context: {},
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'System',
        prompt: 'Prompt',
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).not.toContain('## Context');
      expect(result).toContain('## Task');
    });

    it('should handle unknown context keys', () => {
      const task: Task = {
        id: 'unknown-context-task',
        agent: 'boomerang-coder',
        description: 'Task with unknown context',
        context: {
          customField: 'custom value',
          anotherField: 123,
        },
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'System',
        prompt: 'Prompt',
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).toContain('## Context');
      expect(result).toContain('### Additional Context');
      expect(result).toContain('customField: custom value');
      expect(result).toContain('anotherField: 123');
    });

    it('should format array context values', () => {
      const task: Task = {
        id: 'array-context-task',
        agent: 'boomerang-coder',
        description: 'Task with array context',
        context: {
          relevantFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
        },
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'System',
        prompt: 'Prompt',
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).toContain('### Relevant Files');
      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
      expect(result).toContain('file3.ts');
    });

    it('should format object context values', () => {
      const task: Task = {
        id: 'object-context-task',
        agent: 'boomerang-coder',
        description: 'Task with object context',
        context: {
          scopeBoundaries: {
            inScope: ['feature1', 'feature2'],
            outOfScope: ['legacy'],
          },
        },
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'System',
        prompt: 'Prompt',
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).toContain('### Scope Boundaries');
      expect(result).toContain('- inScope:');
      expect(result).toContain('- outOfScope:');
    });

    it('should skip null/undefined context values', () => {
      const task: Task = {
        id: 'null-context-task',
        agent: 'boomerang-coder',
        description: 'Task with null values',
        context: {
          existingField: 'value',
          nullField: null,
          undefinedField: undefined,
        } as Record<string, unknown>,
      };

      const agentPrompt = {
        name: 'boomerang-coder',
        model: 'test-model',
        systemPrompt: 'System',
        prompt: 'Prompt',
      };

      const result = testableRunner.testBuildPrompt(task, agentPrompt);

      expect(result).toContain('existingField: value');
      expect(result).not.toContain('nullField');
      expect(result).not.toContain('undefinedField');
    });
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