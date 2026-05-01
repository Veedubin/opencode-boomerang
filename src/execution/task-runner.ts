/**
 * Task Runner - Orchestrates agent task execution using the spawner
 */

import { randomUUID } from 'node:crypto';
import type { AgentSpawner, AgentProcess } from './agent-spawner.js';
import type { AgentPromptLoader, AgentPrompt } from './agent-prompts.js';

export interface Task {
  id: string;
  agent: string;
  description: string;
  context?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high';
}

export interface ExecutionContext {
  sessionId: string;
  taskGraph?: Task[];
  parentTask?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output: string;
  agentUsed: string;
  durationMs: number;
  tokensUsed?: number;
  error?: string;
}

export class TaskRunner {
  private spawner: AgentSpawner;
  private promptLoader: AgentPromptLoader;

  constructor(spawner: AgentSpawner, promptLoader: AgentPromptLoader) {
    this.spawner = spawner;
    this.promptLoader = promptLoader;
  }

  /**
   * Execute a single task
   */
  async execute(task: Task, context: ExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const taskId = task.id || randomUUID();

    try {
      // Load agent prompt
      const agentPrompt = await this.promptLoader.loadAgent(task.agent);

      // Build the full prompt
      const fullPrompt = this.buildPrompt(task, agentPrompt);

      // Spawn the agent process
      const agentProcess = await this.spawner.spawn(task.agent, fullPrompt);

      // Wait for completion (with internal timeout handling)
      const result = await this.waitForCompletion(agentProcess);

      const durationMs = Date.now() - startTime;

      return {
        taskId,
        success: result.success,
        output: result.output,
        agentUsed: task.agent,
        durationMs,
        error: result.error,
      };
    } catch (error) {
      return {
        taskId,
        success: false,
        output: '',
        agentUsed: task.agent,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute multiple tasks
   */
  async executeAll(tasks: Task[], context: ExecutionContext): Promise<TaskExecutionResult[]> {
    // Execute tasks in sequence to avoid concurrency issues
    // In a more advanced implementation, could parallelize with dependency management
    const results: TaskExecutionResult[] = [];

    for (const task of tasks) {
      const result = await this.execute(task, context);
      results.push(result);

      // If task failed and it's critical, could stop here
      // For now, continue executing all tasks
    }

    return results;
  }

  /**
   * Wait for agent process completion and parse result
   */
  private waitForCompletion(agentProcess: AgentProcess): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      // Poll for completion since we can't use async with standard ChildProcess events
      const checkInterval = setInterval(() => {
        if (agentProcess.status !== 'running') {
          clearInterval(checkInterval);
          
          const parsed = this.parseResult(agentProcess.output);
          resolve({
            success: agentProcess.status === 'completed' && parsed.success,
            output: parsed.result,
            error: parsed.error || (agentProcess.status === 'timeout' ? 'Execution timed out' : undefined),
          });
        }
      }, 50); // Check every 50ms

      // Safety timeout - if we haven't resolved after 10 minutes, force resolve
      setTimeout(() => {
        clearInterval(checkInterval);
        if (agentProcess.status === 'running') {
          agentProcess.kill();
        }
        resolve({
          success: false,
          output: '',
          error: 'Task execution timeout',
        });
      }, 600000); // 10 minute hard timeout
    });
  }

  /**
   * Build the full prompt from task and agent prompt template
   */
  private buildPrompt(task: Task, agentPrompt: AgentPrompt): string {
    // Start with agent system prompt if available
    let fullPrompt = '';

    if (agentPrompt.systemPrompt) {
      fullPrompt += `${agentPrompt.systemPrompt}\n\n`;
    }

    // Add task context if available
    if (task.context) {
      fullPrompt += `## Context\n`;
      for (const [key, value] of Object.entries(task.context)) {
        fullPrompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
      fullPrompt += '\n';
    }

    // Add the main task description
    fullPrompt += `## Task\n${task.description}\n`;

    // Add execution instructions
    fullPrompt += `\n## Instructions\n`;
    fullPrompt += `1. Execute the task described above\n`;
    fullPrompt += `2. Return a summary of what was accomplished\n`;
    fullPrompt += `3. Include any files modified or created\n`;

    return fullPrompt;
  }

  /**
   * Parse the JSON output from agent execution
   */
  private parseResult(output: string): { success: boolean; result: string; error?: string } {
    if (!output || output.trim() === '') {
      return { success: false, result: '', error: 'Empty output from agent' };
    }

    try {
      // Find JSON in output (in case there's logging before the JSON)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        // No JSON found - treat entire output as result
        return { success: true, result: output.trim() };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        success: parsed.success ?? true,
        result: parsed.result || parsed.output || '',
        error: parsed.error,
      };
    } catch (error) {
      // Failed to parse JSON - treat output as plain text result
      return { success: true, result: output.trim() };
    }
  }
}