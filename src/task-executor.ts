/**
 * TaskExecutor - Executes task graphs with loop prevention and timeout handling
 */

import type { Task, TaskGraph, TaskResult, TaskStatus } from './orchestrator.js';
import { Orchestrator } from './orchestrator.js';
import { ProtocolEnforcer, DEFAULT_ENFORCEMENT_CONFIG } from './protocol/enforcer.js';
import { globalMiddleware, type MiddlewareContext } from './middleware/pipeline.js';
import { protocolTracker } from './protocol/tracker.js';
import { metricsCollector } from './metrics/collector.js';
import { contextMonitor } from './context/monitor.js';

const TASK_COMPLETE_SIGNAL = 'TASK_COMPLETE';

/** Default timeout for task execution (2 minutes) */
const DEFAULT_TASK_TIMEOUT = 2 * 60 * 1000;

/**
 * Calculate text similarity between two strings
 * Uses combined scoring for accurate loop detection
 * Returns value between 0 and 1 (1 = identical)
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  if (!text1 || !text2) return 0;
  
  // Normalize strings
  const norm1 = text1.toLowerCase().trim();
  const norm2 = text2.toLowerCase().trim();
  
  if (norm1 === norm2) return 1;
  
  // Check for exact substring match (one contains the other)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length < norm2.length ? norm2 : norm1;
    // Scale by how much of the longer string is covered
    return shorter.length / longer.length;
  }
  
  // Check prefix overlap (how much they share at start)
  let prefixLen = 0;
  const minLen = Math.min(norm1.length, norm2.length);
  for (let i = 0; i < minLen; i++) {
    if (norm1[i] === norm2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }
  const prefixScore = prefixLen / minLen;
  
  // Check suffix overlap
  let suffixLen = 0;
  for (let i = 0; i < minLen; i++) {
    const idx1 = norm1.length - 1 - i;
    const idx2 = norm2.length - 1 - i;
    if (idx1 >= 0 && idx2 >= 0 && norm1[idx1] === norm2[idx2]) {
      suffixLen++;
    } else {
      break;
    }
  }
  const suffixScore = suffixLen / minLen;
  
  // Use Jaccard similarity for word-based comparison
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;
  
  // Check for shared bigrams
  const getBigrams = (text: string): Set<string> => {
    const words = text.split(/\s+/);
    const bigrams = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(norm1);
  const bigrams2 = getBigrams(norm2);
  const bigramIntersection = new Set([...bigrams1].filter(b => bigrams2.has(b)));
  const bigramUnion = new Set([...bigrams1, ...bigrams2]);
  const bigramScore = bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;
  
  // Combined score - take the highest score (for loop detection we care about any high similarity)
  // Weight bigrams and prefix higher for task comparison
  return Math.max(prefixScore, suffixScore, jaccard, bigramScore);
}

/**
 * TaskExecutor class - executes tasks with loop prevention
 */
export class TaskExecutor {
  private orchestrator: Orchestrator;
  private maxDepth: number;
  private maxIterations: number;
  private taskTimeout: number;

  /**
   * Create a TaskExecutor
   * @param orchestrator - The orchestrator for planning
   * @param maxDepth - Maximum dependency depth to prevent deep nesting (default 5)
   * @param maxIterations - Maximum iterations to prevent infinite loops (default 15)
   */
  constructor(
    orchestrator: Orchestrator,
    maxDepth: number = 5,
    maxIterations: number = 15
  ) {
    this.orchestrator = orchestrator;
    this.maxDepth = maxDepth;
    this.maxIterations = maxIterations;
    this.taskTimeout = DEFAULT_TASK_TIMEOUT;
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
   * Execute a single task
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

      // Execute via middleware pipeline
      const ctx: MiddlewareContext = {
        sessionId, taskId: task.id, agent: task.agent,
        taskDescription: task.description, metadata: {},
      };

      protocolTracker.recordToolCall(sessionId, `agent:${task.agent}`, {
        taskId: task.id,
        taskType: task.type,
        description: task.description.slice(0, 100),
      });

      let result: string = '';
      await globalMiddleware.execute(ctx, async () => {
        result = await this.executeWithTimeout(task);
        contextMonitor.estimateUsage(result);
      });

      // Track code changes
      if (task.type === 'code') {
        protocolTracker.markCodeChanges(sessionId);
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
   * Execute task with timeout protection
   */
  private executeWithTimeout(task: Task): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timeout after ${this.taskTimeout}ms`));
      }, this.taskTimeout);

      // Execute synchronously since simulateAgentExecution is fast
      try {
        const output = this.simulateAgentExecution(task);
        clearTimeout(timeoutId);
        resolve(output);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Simulate agent execution (placeholder for real agent invocation)
   * In production, this would load and execute the actual agent
   */
  private simulateAgentExecution(task: Task): string {
    // This is a placeholder - in a real implementation,
    // the agent would be loaded and executed here
    const agentName = task.agent;
    const taskType = task.type;
    const description = task.description;
    
    // Return simulated output
    return `[${agentName}] executed ${taskType} task: ${description}`;
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