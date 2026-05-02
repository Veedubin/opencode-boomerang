/**
 * TaskExecutor - Executes task graphs with loop prevention and timeout handling
 * 
 * Protocol Enforcement v4.0: Uses real TaskRunner for agent execution
 * instead of simulated execution.
 */

import type { Task, TaskGraph, TaskResult, TaskStatus } from './orchestrator.js';
import { Orchestrator } from './orchestrator.js';
import { ProtocolEnforcer, DEFAULT_ENFORCEMENT_CONFIG } from './protocol/enforcer.js';
import { globalMiddleware, type MiddlewareContext } from './middleware/pipeline.js';
import { metricsCollector } from './metrics/collector.js';
import { contextMonitor } from './context/monitor.js';
import { TaskRunner, AgentSpawner, AgentPromptLoader } from './execution/index.js';
import { ProtocolStateMachine } from './protocol/state-machine.js';
import { calculateSimilarity } from './utils/similarity.js';

const TASK_COMPLETE_SIGNAL = 'TASK_COMPLETE';

/** Default timeout for task execution (2 minutes) */
const DEFAULT_TASK_TIMEOUT = 2 * 60 * 1000;

/**
 * Create default TaskRunner instance
 */
function createDefaultTaskRunner(): TaskRunner {
  const spawner = new AgentSpawner();
  const loader = new AgentPromptLoader();
  return new TaskRunner(spawner, loader);
}

/**
 * TaskExecutor class - executes tasks with loop prevention
 * 
 * Protocol Enforcement v4.0: Uses real TaskRunner for agent execution
 */
export interface TaskExecutorOptions {
  orchestrator?: Orchestrator;
  maxDepth?: number;
  maxIterations?: number;
  taskRunner?: TaskRunner;
  stateMachine?: ProtocolStateMachine;
}

export class TaskExecutor {
  private orchestrator: Orchestrator;
  private maxDepth: number;
  private maxIterations: number;
  private taskTimeout: number;
  private taskRunner: TaskRunner;
  private stateMachine?: ProtocolStateMachine;

  /**
   * Create a TaskExecutor
   * Supports both old signature (orchestrator, maxDepth, maxIterations)
   * and new options object signature
   */
  constructor(optionsOrOrchestrator: TaskExecutorOptions | Orchestrator = {}, maxDepth?: number, maxIterations?: number) {
    // Handle backward compatibility: old signature (orchestrator, maxDepth, maxIterations)
    if (typeof optionsOrOrchestrator === 'object' && 'planTask' in optionsOrOrchestrator) {
      this.orchestrator = optionsOrOrchestrator;
      this.maxDepth = maxDepth ?? 5;
      this.maxIterations = maxIterations ?? 15;
      this.taskTimeout = DEFAULT_TASK_TIMEOUT;
      this.taskRunner = createDefaultTaskRunner();
    } else {
      // New options object signature
      const options = optionsOrOrchestrator as TaskExecutorOptions;
      this.orchestrator = options.orchestrator!;
      this.maxDepth = options.maxDepth ?? 5;
      this.maxIterations = options.maxIterations ?? 15;
      this.taskTimeout = DEFAULT_TASK_TIMEOUT;
      this.taskRunner = options.taskRunner ?? createDefaultTaskRunner();
      this.stateMachine = options.stateMachine;
    }
  }

  /**
   * Set custom timeout for task execution
   */
  setTaskTimeout(timeoutMs: number): void {
    this.taskTimeout = timeoutMs;
  }

  /**
   * Calculate the depth of a task in the dependency graph
   * (longest path from any root to this task)
   */
  private calculateTaskDepth(taskId: string, graph: TaskGraph, cache: Map<string, number> = new Map()): number {
    if (cache.has(taskId)) return cache.get(taskId)!;
    
    const task = graph.tasks.find(t => t.id === taskId);
    if (!task) {
      cache.set(taskId, 0);
      return 0;
    }
    
    if (task.dependencies.length === 0) {
      cache.set(taskId, 0);
      return 0;
    }
    
    const maxDepDepth = Math.max(
      ...task.dependencies.map(dep => this.calculateTaskDepth(dep, graph, cache))
    );
    const depth = maxDepDepth + 1;
    cache.set(taskId, depth);
    return depth;
  }

  /**
   * Execute a task graph
   * @param graph - The task graph to execute
   * @returns Promise resolving to array of task results
   */
  async execute(graph: TaskGraph): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const taskMap = new Map<string, Task>();
    const executedTasks = new Set<string>();
    const taskHistory: Task[] = [];
    let iterations = 0;
    
    // Initialize task map
    for (const task of graph.tasks) {
      taskMap.set(task.id, { ...task });
    }
    
    // Validate graph first
    if (!this.orchestrator.validateGraph(graph)) {
      return [{
        taskId: 'validation',
        success: false,
        output: '',
        error: 'Invalid task graph: cycle detected or missing dependencies',
        duration: 0,
      }];
    }
    
    // Calculate depth cache for all tasks
    const depthCache = new Map<string, number>();
    for (const task of graph.tasks) {
      this.calculateTaskDepth(task.id, graph, depthCache);
    }
    
    // Get execution order from orchestrator
    const executionOrder = this.orchestrator.getExecutionOrder(graph);
    
    // Execute tasks in order
    for (const task of executionOrder) {
      // Check max iterations
      iterations++;
      if (iterations > this.maxIterations) {
        results.push({
          taskId: task.id,
          success: false,
          output: '',
          error: `Max iterations (${this.maxIterations}) exceeded`,
          duration: 0,
        });
        continue;
      }
      
      // Check max depth using calculated depth
      const taskDepth = depthCache.get(task.id) ?? 0;
      if (taskDepth > this.maxDepth) {
        results.push({
          taskId: task.id,
          success: false,
          output: '',
          error: `Task depth (${taskDepth}) exceeds max depth (${this.maxDepth})`,
          duration: 0,
        });
        continue;
      }
      
      // Check for loops
      if (this.detectLoop(task, taskHistory)) {
        results.push({
          taskId: task.id,
          success: false,
          output: '',
          error: 'Loop detected: task similar to recent execution history',
          duration: 0,
        });
        taskMap.get(task.id)!.status = 'skipped';
        continue;
      }
      
      // Skip if already executed
      if (executedTasks.has(task.id)) {
        continue;
      }
      
      // Check if dependencies are satisfied
      const depsSatisfied = task.dependencies.every(depId => {
        const depResult = results.find(r => r.taskId === depId);
        return depResult?.success === true;
      });
      
      if (!depsSatisfied) {
        results.push({
          taskId: task.id,
          success: false,
          output: '',
          error: 'Dependencies not satisfied',
          duration: 0,
        });
        taskMap.get(task.id)!.status = 'skipped';
        continue;
      }
      
      // Execute the task
      const result = await this.executeSingle(task);
      results.push(result);
      executedTasks.add(task.id);
      taskHistory.push(task);
      
      // Update task status
      const currentTask = taskMap.get(task.id);
      if (currentTask) {
        currentTask.status = result.success ? 'completed' : 'failed';
        currentTask.result = result;
      }
      
      // Check for TASK_COMPLETE signal
      if (result.output.includes(TASK_COMPLETE_SIGNAL)) {
        // Early stopping - save results and return
        await this.orchestrator.saveResults(results);
        return results;
      }
      
      // Limit history size to prevent memory issues
      if (taskHistory.length > 20) {
        taskHistory.shift();
      }
    }
    
    // Save results to memory (with timeout protection)
    try {
      const savePromise = this.orchestrator.saveResults(results);
      await Promise.race([
        savePromise,
        new Promise(resolve => setTimeout(resolve, 500)) // Max 500ms for save
      ]);
    } catch {
      // Ignore save errors
    }

    return results;
  }

  /**
   * Execute a single task using real TaskRunner
   * @param task - The task to execute
   * @returns Promise resolving to task result
   */
  async executeSingle(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const sessionId = this.orchestrator.sessionId || 'default';
    const enforcer = new ProtocolEnforcer(DEFAULT_ENFORCEMENT_CONFIG);

    // Emit metrics
    metricsCollector.emit({
      type: 'task.started',
      sessionId,
      data: { taskId: task.id, agent: task.agent, taskType: task.type },
    });

    try {
      // PRE-CONDITION CHECKS
      const preCheck = await enforcer.validatePreConditions(sessionId, task.description);
      if (!preCheck.passed) {
        metricsCollector.emit({
          type: 'protocol.violation',
          sessionId,
          data: { taskId: task.id, violations: preCheck.violations.map(v => v.rule) },
        });
        if (preCheck.autoFixed.length !== preCheck.violations.length) {
          return {
            taskId: task.id, success: false, output: '',
            error: `Protocol violations: ${preCheck.violations.map(v => v.message).join(', ')}`,
            duration: Date.now() - startTime,
          };
        }
      }

      // Git check before code changes
      if (task.type === 'code') {
        const gitCheck = await enforcer.enforceGitCheck(sessionId);
        if (!gitCheck.clean) {
          return {
            taskId: task.id, success: false, output: '',
            error: `Working tree not clean. Branch: ${gitCheck.branch}. Commit or stash first.`,
            duration: Date.now() - startTime,
          };
        }
      }

      // Tool call tracking now handled by state machine checkpoints in orchestrator

      // Execute using real TaskRunner (Protocol Enforcement v4.0)
      let result = '';
      const executionContext = {
        sessionId,
        taskGraph: [],
        parentTask: undefined,
        metadata: { taskType: task.type },
      };

      // Execute with timeout
      const execPromise = this.taskRunner.execute(
        {
          id: task.id,
          agent: task.agent,
          description: task.description,
          context: { originalMessage: task.description },
          priority: 'medium',
        },
        executionContext
      );

      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), this.taskTimeout);
      });

      const execResult = await Promise.race([execPromise, timeoutPromise]);
      
      if (execResult === 'timeout') {
        return {
          taskId: task.id,
          success: false,
          output: '',
          error: `Task execution timed out after ${this.taskTimeout}ms`,
          duration: Date.now() - startTime,
        };
      }

      result = execResult.output;
      contextMonitor.estimateUsage(result);

      // Track code changes via state machine
      if (task.type === 'code' && this.stateMachine) {
        this.stateMachine.setCheckpoint(sessionId, 'codeChangesMade', true);
      }

      // POST-CONDITION CHECKS
      const postCheck = await enforcer.validatePostConditions(sessionId);
      if (!postCheck.passed) {
        return {
          taskId: task.id, success: false, output: result,
          error: `Post-execution violations: ${postCheck.violations.map(v => v.message).join(', ')}`,
          duration: Date.now() - startTime,
        };
      }

      // Quality gates after code changes
      if (task.type === 'code') {
        const quality = await enforcer.enforceQualityGates(sessionId);
        if (!quality.passed) {
          return {
            taskId: task.id, success: false, output: result,
            error: `Quality gates failed: ${quality.errors.join(', ')}`,
            duration: Date.now() - startTime,
          };
        }
      }

      // Success metrics
      metricsCollector.emit({
        type: 'task.completed',
        sessionId,
        data: { taskId: task.id, duration: Date.now() - startTime, success: true },
      });

      return { taskId: task.id, success: true, output: result, duration: Date.now() - startTime };

    } catch (error) {
      metricsCollector.emit({
        type: 'task.failed',
        sessionId,
        data: { taskId: task.id, duration: Date.now() - startTime, error: error instanceof Error ? error.message : 'Unknown' },
      });
      return {
        taskId: task.id, success: false, output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect if current task would create a loop
   * Compares text similarity with recent task history
   * @param currentTask - The task to check
   * @param history - Recent task execution history
   * @returns true if loop detected (>90% similarity)
   */
  detectLoop(currentTask: Task, history: Task[]): boolean {
    if (history.length === 0) return false;
    
    const currentText = currentTask.description.toLowerCase();
    
    // Check against recent history (last 5 tasks)
    const recentHistory = history.slice(-5);
    
    for (const pastTask of recentHistory) {
      const pastText = pastTask.description.toLowerCase();
      const similarity = calculateSimilarity(currentText, pastText);
      
      // If >90% similar, likely a loop
      if (similarity > 0.9) {
        return true;
      }
    }
    
    // Also check for repeating agent + type patterns
    const recentSameAgent = history.filter(
      t => t.agent === currentTask.agent && t.type === currentTask.type
    );
    
    if (recentSameAgent.length >= 3) {
      // Multiple similar tasks with same agent - possible loop
      return true;
    }
    
    return false;
  }

  /**
   * Get the status of all tasks in the graph
   */
  getTaskStatuses(graph: TaskGraph): Map<string, TaskStatus> {
    const statuses = new Map<string, TaskStatus>();
    for (const task of graph.tasks) {
      statuses.set(task.id, task.status);
    }
    return statuses;
  }

  /**
   * Get completed tasks count
   */
  getCompletedCount(graph: TaskGraph): number {
    return graph.tasks.filter(t => t.status === 'completed').length;
  }

  /**
   * Get failed tasks count
   */
  getFailedCount(graph: TaskGraph): number {
    return graph.tasks.filter(t => t.status === 'failed').length;
  }
}

export { TASK_COMPLETE_SIGNAL, DEFAULT_TASK_TIMEOUT };
