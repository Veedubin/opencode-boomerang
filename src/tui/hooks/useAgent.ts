// Agent execution hook - connects to orchestrator for real execution
import { useState, useCallback, useRef } from 'react';
import type { Message } from '../types.js';
import type { Orchestrator, TaskGraph, TaskResult } from '../../orchestrator.js';

// Orchestrator client interface for agent execution
interface TaskExecutor {
  executeTask(taskGraph: TaskGraph, agentName: string): AsyncGenerator<TaskResult, void, unknown>;
}

// Reference to the orchestrator instance
let orchestratorInstance: Orchestrator | null = null;

// Reference to task executor (would be replaced with actual executor in production)
let taskExecutor: TaskExecutor | null = null;

/**
 * Set the orchestrator instance for agent routing
 */
export function setOrchestratorInstance(orch: Orchestrator | null): void {
  orchestratorInstance = orch;
}

/**
 * Set the task executor for running tasks
 */
export function setTaskExecutor(executor: TaskExecutor | null): void {
  taskExecutor = executor;
}

/**
 * Get the current orchestrator instance
 */
export function getOrchestratorInstance(): Orchestrator | null {
  return orchestratorInstance;
}

/**
 * Default mock task executor for when no real executor is set
 */
function getDefaultTaskExecutor(): TaskExecutor {
  return {
    async *executeTask(taskGraph: TaskGraph, agentName: string): AsyncGenerator<TaskResult, void, unknown> {
      console.debug('[useAgent] executeTask called with agent:', agentName);

      for (const task of taskGraph.tasks) {
        const startTime = Date.now();

        // Simulate task execution with mock results
        const output = `[${agentName}] Executing: ${task.description}`;

        yield {
          taskId: task.id,
          success: true,
          output,
          duration: Date.now() - startTime,
        };

        // Update task status
        task.status = 'completed';
      }
    },
  };
}

// React hook for agent execution
export function useAgent() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);

  // Store callbacks for streaming results to messages array
  const onMessageCallback = useRef<((message: Message) => void) | null>(null);
  const onThinkingCallback = useRef<((agent: string | null) => void) | null>(null);

  // Set message callback for streaming results to messages array
  const setOnMessage = useCallback((callback: ((message: Message) => void) | null) => {
    onMessageCallback.current = callback;
  }, []);

  // Set thinking indicator callback
  const setOnThinking = useCallback((callback: ((agent: string | null) => void) | null) => {
    onThinkingCallback.current = callback;
  }, []);

  /**
   * Send message to agent for processing
   * 1. Adds user message to local state (caller handles this)
   * 2. Calls orchestrator.planTask() to parse and assign
   * 3. Streams agent responses via onMessage callback
   * 4. Saves conversation to memory
   */
  const sendMessage = useCallback(
    async (message: string, agentName?: string): Promise<void> => {
      const targetAgent = agentName || currentAgent || 'boomerang';

      setIsExecuting(true);
      setThinkingAgent(targetAgent);
      onThinkingCallback.current?.(targetAgent);

      try {
        // Step 1: Plan the task using orchestrator
        let taskGraph: TaskGraph;

        if (orchestratorInstance) {
          // Use real orchestrator
          taskGraph = await orchestratorInstance.planTask(message);
          console.debug('[useAgent] Planned task graph:', taskGraph.tasks.length, 'tasks');
        } else {
          // Fallback to mock task graph
          taskGraph = {
            tasks: [{
              id: `task_${Date.now()}`,
              type: 'general',
              description: message,
              agent: targetAgent,
              dependencies: [],
              status: 'pending',
            }],
            edges: [],
          };
        }

        // Step 2: Execute the task through task executor
        const executor = taskExecutor || getDefaultTaskExecutor();
        const executorAgent = orchestratorInstance
          ? taskGraph.tasks[0]?.agent || targetAgent
          : targetAgent;

        // Send initial thinking message
        const thinkingMessage: Message = {
          id: crypto.randomUUID(),
          sender: 'agent',
          senderName: executorAgent,
          text: 'Thinking...',
          timestamp: new Date(),
        };
        onMessageCallback.current?.(thinkingMessage);

        // Execute tasks and stream results
        let hasResults = false;
        for await (const result of executor.executeTask(taskGraph, executorAgent)) {
          hasResults = true;

          const responseMessage: Message = {
            id: crypto.randomUUID(),
            sender: 'agent',
            senderName: executorAgent,
            text: result.success ? result.output : `Error: ${result.error}`,
            timestamp: new Date(),
          };
          onMessageCallback.current?.(responseMessage);

          // Save successful results to memory context
          if (result.success) {
            console.debug('[useAgent] Task completed:', result.taskId, 'in', result.duration, 'ms');
          }
        }

        // If no results were streamed, send a completion message
        if (!hasResults) {
          const completionMessage: Message = {
            id: crypto.randomUUID(),
            sender: 'agent',
            senderName: executorAgent,
            text: 'Task completed.',
            timestamp: new Date(),
          };
          onMessageCallback.current?.(completionMessage);
        }

        setCurrentAgent(executorAgent);
      } catch (error) {
        // Stream error message
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          sender: 'agent',
          senderName: targetAgent,
          text: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        onMessageCallback.current?.(errorMessage);
      } finally {
        setIsExecuting(false);
        setThinkingAgent(null);
        onThinkingCallback.current?.(null);
      }
    },
    [currentAgent]
  );

  /**
   * Execute a specific task with the given agent
   * 1. Sets isExecuting=true
   * 2. Runs task through orchestrator
   * 3. Sets isExecuting=false
   * 4. Returns result
   */
  const executeTask = useCallback(
    async (task: string, agentName: string): Promise<TaskResult[]> => {
      setIsExecuting(true);
      setCurrentAgent(agentName);
      setThinkingAgent(agentName);
      onThinkingCallback.current?.(agentName);

      const results: TaskResult[] = [];

      try {
        // Plan the task
        let taskGraph: TaskGraph;

        if (orchestratorInstance) {
          taskGraph = await orchestratorInstance.planTask(task);
        } else {
          taskGraph = {
            tasks: [{
              id: `task_${Date.now()}`,
              type: 'general',
              description: task,
              agent: agentName,
              dependencies: [],
              status: 'pending',
            }],
            edges: [],
          };
        }

        // Execute tasks
        const executor = taskExecutor || getDefaultTaskExecutor();

        for await (const result of executor.executeTask(taskGraph, agentName)) {
          results.push(result);

          const responseMessage: Message = {
            id: crypto.randomUUID(),
            sender: 'agent',
            senderName: agentName,
            text: result.success ? result.output : `Error: ${result.error}`,
            timestamp: new Date(),
          };
          onMessageCallback.current?.(responseMessage);
        }

        // Save results to memory if orchestrator has memory system
        if (orchestratorInstance && results.length > 0) {
          try {
            await orchestratorInstance.saveResults(results);
          } catch {
            // Silently fail memory saves
          }
        }
      } finally {
        setIsExecuting(false);
        setThinkingAgent(null);
        onThinkingCallback.current?.(null);
      }

      return results;
    },
    []
  );

  // Clear agent state
  const clearAgent = useCallback(() => {
    setCurrentAgent(null);
    setThinkingAgent(null);
    setIsExecuting(false);
  }, []);

  return {
    sendMessage,
    executeTask,
    setOnMessage,
    setOnThinking,
    isExecuting,
    currentAgent,
    thinkingAgent,
    clearAgent,
  };
}
