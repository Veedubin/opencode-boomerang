/**
 * Orchestrator - Task planning and dependency graph management
 * Plans tasks, assigns agents, builds dependency graphs
 */

import { getMemoryService, MemoryService } from './memory-service.js';
import { ProtocolEnforcer, DEFAULT_ENFORCEMENT_CONFIG } from './protocol/enforcer.js';
import { protocolTracker } from './protocol/tracker.js';
import { contextMonitor } from './context/monitor.js';
import { contextCompactor } from './context/compactor.js';
import { metricsCollector } from './metrics/collector.js';
import { scoringRouter } from './routing/scoring-router.js';

// Task types for agent assignment
export type TaskType = 'explore' | 'code' | 'test' | 'review' | 'write' | 'git' | 'general';

/** Task status tracking */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Task definition */
export interface Task {
  id: string;
  type: TaskType;
  description: string;
  agent: string;
  dependencies: string[];
  status: TaskStatus;
  result?: TaskResult;
}

/** Task graph with nodes and edges */
export interface TaskGraph {
  tasks: Task[];
  edges: [string, string][]; // [from, to] - from depends on to
}

/** Task execution result */
export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number; // ms
}

/** Agent definition loaded from asset loader */
export interface AgentDefinition {
  name: string;
  description: string;
  keywords: string[];
  skill?: string;
}

// Agent keyword mappings (order matters - more specific keywords first)
const AGENT_KEYWORDS: Record<TaskType, string[]> = {
  explore: ['explore', 'find', 'search', 'locate', 'discover'],
  write: ['doc', 'documentation', 'readme', 'md', 'write'],
  test: ['test', 'testing', 'verify', 'check', 'validate'],
  review: ['review', 'analyze', 'assess', 'evaluate', 'architect'],
  git: ['git', 'commit', 'push', 'branch', 'merge', 'pull', 'checkout'],
  code: ['code', 'implement', 'create', 'add', 'build', 'make'],
  general: ['general', 'default', 'misc'],
};

/** Default agents */
const DEFAULT_AGENTS: AgentDefinition[] = [
  { name: 'researcher', description: 'Web research specialist', keywords: ['research', 'search', 'web', 'fetch'] },
  { name: 'boomerang-explorer', description: 'Codebase exploration specialist', keywords: AGENT_KEYWORDS.explore },
  { name: 'boomerang-coder', description: 'Fast code generation specialist', keywords: AGENT_KEYWORDS.code },
  { name: 'boomerang-tester', description: 'Comprehensive testing specialist', keywords: AGENT_KEYWORDS.test },
  { name: 'boomerang-architect', description: 'Design decisions and architecture review', keywords: AGENT_KEYWORDS.review },
  { name: 'boomerang-writer', description: 'Documentation and markdown writing', keywords: AGENT_KEYWORDS.write },
  { name: 'boomerang-git', description: 'Version control specialist', keywords: AGENT_KEYWORDS.git },
  { name: 'boomerang', description: 'General purpose agent', keywords: AGENT_KEYWORDS.general },
];

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Detect task type from description keywords
 * Uses first-match strategy based on keyword ordering
 */
function detectTaskType(description: string): TaskType {
  const lowerDesc = description.toLowerCase();
  
  // Define keyword priorities explicitly (more specific first)
  const keywordPriority: [TaskType, string][] = [
    // Write/Doc keywords (before code's 'write')
    ['write', 'documentation'],
    ['write', 'readme'],
    ['write', 'md'],
    ['write', 'doc'],
    // Review keywords
    ['review', 'review'],
    ['review', 'architect'],
    ['review', 'analyze'],
    // Git keywords
    ['git', 'commit'],
    ['git', 'push'],
    ['git', 'branch'],
    ['git', 'merge'],
    // Test keywords
    ['test', 'test'],
    ['test', 'testing'],
    ['test', 'verify'],
    // Explore keywords
    ['explore', 'explore'],
    ['explore', 'find'],
    ['explore', 'discover'],
    // Code keywords
    ['code', 'code'],
    ['code', 'implement'],
    ['code', 'create'],
    ['code', 'add'],
    ['code', 'build'],
    ['code', 'make'],
  ];
  
  for (const [type, keyword] of keywordPriority) {
    if (lowerDesc.includes(keyword)) {
      return type;
    }
  }
  
  return 'general';
}

/**
 * Assign agent based on task type
 */
function assignAgent(taskType: TaskType, agents: AgentDefinition[]): string {
  const agent = agents.find(a => a.keywords.includes(taskType));
  return agent?.name ?? 'boomerang';
}

/**
 * Orchestrator class - plans and validates task graphs
 */
export class Orchestrator {
  private agents: AgentDefinition[];
  private memoryService: MemoryService;
  private autoMemory: boolean = true;
  public sessionId: string = 'orchestrator';

  /**
   * Create a new Orchestrator
   * @param agents - Agent definitions available for task assignment
   * @param memoryService - Optional memory service for context queries
   */
  constructor(agents: AgentDefinition[] = DEFAULT_AGENTS, memoryService?: MemoryService) {
    this.agents = agents;
    this.memoryService = memoryService || getMemoryService();

    // Context monitoring thresholds
    contextMonitor.onThreshold(40, 'compact', async () => {
      const result = await contextCompactor.compact(this.sessionId);
      if (result.success) {
        console.log(`[Context] Compacted: ${result.summary}`);
      }
    });

    contextMonitor.onThreshold(80, 'handoff', async () => {
      await contextCompactor.compact(this.sessionId);
      throw new Error('CONTEXT_FULL_HANDOFF_REQUIRED: Context at 80%. Start new session.');
    });
  }

  /**
   * Enable/disable automatic memory integration
   */
  setAutoMemory(enabled: boolean): void {
    this.autoMemory = enabled;
  }

  /**
   * Query memories for relevant context before planning
   */
  async queryContext(query: string): Promise<any[]> {
    if (!this.autoMemory) return [];
    
    try {
      const results = await this.memoryService.queryMemories(query, { limit: 10 });
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Save task results to memory system
   */
  async saveResults(results: TaskResult[]): Promise<void> {
    if (!this.autoMemory || results.length === 0) return;

    try {
      for (const result of results) {
        const summary = result.success
          ? `Task completed: ${result.output}`
          : `Task failed: ${result.error ?? 'Unknown error'}`;

        await this.memoryService.addMemory({
          content: summary,
          sourceType: 'conversation',
          sessionId: this.sessionId,
          metadata: { type: 'session_summary' },
        });
      }
    } catch {
      // Silently fail memory saves
    }
  }

  /**
   * Parse user request and create task graph
   */
  async planTask(request: string): Promise<TaskGraph> {
    // Parse request into subtasks
    const subtasks = this.parseRequest(request);
    
    // Build tasks with agent assignments
    const tasks: Task[] = [];
    for (const desc of subtasks) {
      const type = detectTaskType(desc);
      
      // Try metrics-based routing first
      let assignedAgent = 'boomerang';
      try {
        const routing = await scoringRouter.selectAgent(type);
        assignedAgent = routing.agent;
      } catch {
        // Fallback to keyword-based routing
        assignedAgent = assignAgent(type, this.agents);
      }
      
      // Emit routing decision metrics
      metricsCollector.emit({
        type: 'routing.decision',
        sessionId: this.sessionId,
        data: { taskType: type, agent: assignedAgent, method: 'keyword' },
      });
      
      tasks.push({
        id: generateTaskId(),
        type,
        description: desc,
        agent: assignedAgent,
        dependencies: [],
        status: 'pending' as TaskStatus,
      });
    }
    
    // Build dependency graph
    const edges = this.buildEdges(tasks);
    
    // Assign dependencies to tasks
    for (const [from, to] of edges) {
      const fromTask = tasks.find(t => t.id === from);
      if (fromTask && !fromTask.dependencies.includes(to)) {
        fromTask.dependencies.push(to);
      }
    }
    
    return { tasks, edges };
  }

  /**
   * Parse request into subtask descriptions
   */
  private parseRequest(request: string): string[] {
    // Split by common delimiters: newlines, semicolons, "then", "and then"
    const parts = request
      .split(/\n|;|(?:\s+then\s+)/i)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // If no clear separation, try to split by conjunctions
    if (parts.length === 1) {
      const conjunctions = [', then ', ', and ', ' and then ', ' then '];
      for (const conj of conjunctions) {
        if (parts[0].includes(conj)) {
          return parts[0].split(conj).map(p => p.trim()).filter(p => p.length > 0);
        }
      }
      
      // Try splitting by "，接着", "然后" for Chinese
      if (parts[0].includes('，然后') || parts[0].includes('，接着')) {
        return parts[0].split(/[，；](?:然后|接着)/).map(p => p.trim()).filter(p => p.length > 0);
      }
    }
    
    return parts.length > 0 ? parts : [request];
  }

  /**
   * Build edges (dependencies) between tasks
   * By default, tasks depend on the previous task (sequential)
   */
  private buildEdges(tasks: Task[]): [string, string][] {
    if (tasks.length <= 1) return [];
    
    const edges: [string, string][] = [];
    for (let i = 1; i < tasks.length; i++) {
      // Task i depends on task i-1 (must complete before starting)
      edges.push([tasks[i].id, tasks[i - 1].id]);
    }
    
    return edges;
  }

  /**
   * Validate a task graph for cycles and consistency
   */
  validateGraph(graph: TaskGraph): boolean {
    // Check for cycles using DFS
    if (this.hasCycle(graph)) {
      return false;
    }
    
    // Check all dependencies exist
    const taskIds = new Set(graph.tasks.map(t => t.id));
    for (const task of graph.tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          return false;
        }
      }
    }
    
    // Check agent assignments are valid
    const validAgents = new Set(this.agents.map(a => a.name));
    for (const task of graph.tasks) {
      if (!validAgents.has(task.agent)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check for cycles using depth-first search
   */
  private hasCycle(graph: TaskGraph): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    
    // Build adjacency list from edges
    const adjList = new Map<string, string[]>();
    for (const task of graph.tasks) {
      adjList.set(task.id, []);
    }
    for (const [from, to] of graph.edges) {
      const deps = adjList.get(from) ?? [];
      deps.push(to);
      adjList.set(from, deps);
    }
    
    // DFS from each node
    for (const task of graph.tasks) {
      if (this.dfsCycleCheck(task.id, adjList, visited, recStack)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * DFS helper for cycle detection
   */
  private dfsCycleCheck(
    nodeId: string,
    adjList: Map<string, string[]>,
    visited: Set<string>,
    recStack: Set<string>
  ): boolean {
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      recStack.add(nodeId);
      
      const neighbors = adjList.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (this.dfsCycleCheck(neighbor, adjList, visited, recStack)) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          return true; // Cycle found
        }
      }
    }
    
    recStack.delete(nodeId);
    return false;
  }

  /**
   * Optimize a task graph
   * - Remove redundant dependencies
   * - Parallelize independent tasks
   * - Sort by dependency depth
   */
  optimizeGraph(graph: TaskGraph): TaskGraph {
    // Build dependency depth map
    const depthMap = new Map<string, number>();
    
    // Calculate depth for each task (max depth from leaves)
    const calculateDepth = (taskId: string, visited: Set<string> = new Set()): number => {
      if (depthMap.has(taskId)) return depthMap.get(taskId)!;
      if (visited.has(taskId)) return 0; // Cycle protection
      
      visited.add(taskId);
      const task = graph.tasks.find(t => t.id === taskId);
      if (!task || task.dependencies.length === 0) {
        depthMap.set(taskId, 0);
        return 0;
      }
      
      const maxDepDepth = Math.max(
        ...task.dependencies.map(dep => calculateDepth(dep, visited))
      );
      const depth = maxDepDepth + 1;
      depthMap.set(taskId, depth);
      return depth;
    };
    
    // Calculate depths for all tasks
    for (const task of graph.tasks) {
      calculateDepth(task.id);
    }
    
    // Remove redundant edges (transitive dependencies)
    const optimizedEdges = this.removeTransitiveEdges(graph);
    
    // Sort tasks by depth (tasks with lower depth first)
    const sortedTasks = [...graph.tasks].sort((a, b) => {
      const depthA = depthMap.get(a.id) ?? 0;
      const depthB = depthMap.get(b.id) ?? 0;
      return depthA - depthB;
    });
    
    return {
      tasks: sortedTasks,
      edges: optimizedEdges,
    };
  }

  /**
   * Remove transitive edges from graph
   */
  private removeTransitiveEdges(graph: TaskGraph): [string, string][] {
    const edges = [...graph.edges];
    const directDeps = new Map<string, Set<string>>();
    
    // Initialize direct dependencies
    for (const task of graph.tasks) {
      directDeps.set(task.id, new Set(task.dependencies));
    }
    
    // Remove transitive edges: if A -> B and B -> C, and A -> C exists, remove A -> C
    let changed = true;
    while (changed) {
      changed = false;
      for (const task of graph.tasks) {
        const taskDeps = directDeps.get(task.id)!;
        const toRemove: string[] = [];
        
        for (const depId of taskDeps) {
          const depTask = graph.tasks.find(t => t.id === depId);
          if (!depTask) continue;
          
          // Check if any of task's direct deps are reachable through depId
          for (const transitiveDep of depTask.dependencies) {
            if (taskDeps.has(transitiveDep)) {
              toRemove.push(transitiveDep);
            }
          }
        }
        
        for (const rem of toRemove) {
          taskDeps.delete(rem);
          edges.splice(edges.findIndex(e => e[0] === task.id && e[1] === rem), 1);
          changed = true;
        }
      }
    }
    
    return edges;
  }

  /**
   * Get topological order for task execution
   */
  getExecutionOrder(graph: TaskGraph): Task[] {
    // Build in-degree map
    // Edge [from, to] means "from depends on to" (from must wait for to)
    // So we increment in-degree of the SOURCE (the dependent)
    const inDegree = new Map<string, number>();
    for (const task of graph.tasks) {
      inDegree.set(task.id, 0);
    }
    for (const [from, to] of graph.edges) {
      inDegree.set(from, (inDegree.get(from) ?? 0) + 1);
    }
    
    // Start with tasks that have no dependencies (in-degree 0)
    const queue: Task[] = graph.tasks.filter(t => (inDegree.get(t.id) ?? 0) === 0);
    const result: Task[] = [];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      // Sort queue to ensure deterministic order
      queue.sort((a, b) => a.id.localeCompare(b.id));
      const task = queue.shift()!;
      if (visited.has(task.id)) continue;
      
      visited.add(task.id);
      result.push(task);
      
      // Reduce in-degree for tasks that depend on completed task
      for (const [from, to] of graph.edges) {
        if (to === task.id) {
          const newDegree = (inDegree.get(from) ?? 0) - 1;
          inDegree.set(from, newDegree);
          
          if (newDegree === 0) {
            const dependent = graph.tasks.find(t => t.id === from);
            if (dependent && !visited.has(from)) {
              queue.push(dependent);
            }
          }
        }
      }
    }
    
    return result;
  }
}

export { DEFAULT_AGENTS, AGENT_KEYWORDS };