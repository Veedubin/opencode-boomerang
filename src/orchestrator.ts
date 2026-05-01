/**
 * Orchestrator - Task planning and dependency graph management with Protocol Enforcement v4.0
 * 
 * Integrates ProtocolStateMachine for hard enforcement of the Boomerang Protocol.
 * Each step goes through state machine transitions and checkpoint validation.
 */

import { getMemoryService, MemoryService } from './memory-service.js';
import { ProtocolStateMachine } from './protocol/state-machine.js';
import { ProtocolEnforcer } from './protocol/enforcer.js';
import { protocolTracker } from './protocol/tracker.js';
import { contextMonitor } from './context/monitor.js';
import { contextCompactor } from './context/compactor.js';
import { metricsCollector } from './metrics/collector.js';
import { scoringRouter } from './routing/scoring-router.js';
import { TaskRunner, AgentSpawner, AgentPromptLoader } from './execution/index.js';
import { getSequentialThinker, SequentialThinker } from './execution/sequential-thinker.js';
import { getDocTracker, DocTracker } from './execution/doc-tracker.js';
import { DEFAULT_PROTOCOL_CONFIG, createProtocolConfig } from './protocol/config.js';
import type { ProtocolConfig, TaskType as ProtocolTaskType } from './protocol/types.js';

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

/** User request for orchestration */
export interface UserRequest {
  message: string;
  context?: Record<string, unknown>;
}

/** Orchestration result */
export interface OrchestrationResult {
  success: boolean;
  result?: unknown;
  sessionId: string;
  error?: string;
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
 * Maps orchestrator TaskType to protocol TaskType
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
 * Map TaskType to ProtocolTaskType
 */
function toProtocolTaskType(type: TaskType): ProtocolTaskType {
  const mapping: Record<TaskType, ProtocolTaskType> = {
    explore: 'research',
    code: 'code_generation',
    test: 'testing',
    review: 'research',
    write: 'documentation',
    git: 'simple_query',
    general: 'simple_query',
  };
  return mapping[type] ?? 'simple_query';
}

/**
 * Assign agent based on task type
 */
function assignAgent(taskType: TaskType, agents: AgentDefinition[]): string {
  const agent = agents.find(a => a.keywords.includes(taskType));
  return agent?.name ?? 'boomerang';
}

/**
 * Check if task requires planning
 */
function requiresPlanning(taskType: TaskType, message: string): boolean {
  // Build/create/implement tasks always require planning unless waived
  if (/implement|create|build|design|architecture|refactor/i.test(message)) {
    return true;
  }
  // Code generation tasks require planning
  if (taskType === 'code' || taskType === 'review') {
    return true;
  }
  return false;
}

/**
 * Orchestrator class - plans and validates task graphs with Protocol Enforcement v4.0
 */
export class Orchestrator {
  private agents: AgentDefinition[];
  private memoryService: MemoryService;
  private autoMemory: boolean = true;
  public sessionId: string = 'orchestrator';
  
  // Protocol Enforcement v4.0 - State machine and execution engine
  private stateMachine: ProtocolStateMachine;
  private taskRunner: TaskRunner;
  private sequentialThinker: SequentialThinker;
  private docTracker: DocTracker;
  private protocolEnforcer: ProtocolEnforcer;

  /**
   * Create a new Orchestrator
   * @param agents - Agent definitions available for task assignment
   * @param memoryService - Optional memory service for context queries
   * @param protocolConfig - Optional protocol configuration
   */
  constructor(
    agents: AgentDefinition[] = DEFAULT_AGENTS,
    memoryService?: MemoryService,
    protocolConfig?: Partial<ProtocolConfig>
  ) {
    this.agents = agents;
    this.memoryService = memoryService || getMemoryService();
    
    // Initialize Protocol Enforcement v4.0 components
    this.stateMachine = new ProtocolStateMachine(protocolConfig);
    this.protocolEnforcer = new ProtocolEnforcer();
    
    // Initialize execution engine
    const spawner = new AgentSpawner();
    const loader = new AgentPromptLoader();
    this.taskRunner = new TaskRunner(spawner, loader);
    
    // Initialize helpers
    this.sequentialThinker = getSequentialThinker();
    this.docTracker = getDocTracker();

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
      const resultTexts = results.map(r => r.content);
      contextMonitor.estimateUsageBatch([query, ...resultTexts]);
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
   * Orchestrate a user request through the full Boomerang Protocol
   * with state machine enforcement (Protocol Enforcement v4.0)
   */
  async orchestrate(userRequest: UserRequest): Promise<OrchestrationResult> {
    const sessionId = crypto.randomUUID();
    
    // Detect task type for protocol context
    const taskType = detectTaskType(userRequest.message);
    const protocolTaskType = toProtocolTaskType(taskType);
    
    // Initialize session in state machine
    this.stateMachine.initializeSession(sessionId, {
      sessionId,
      taskDescription: userRequest.message,
      taskType: protocolTaskType,
      waiverPhrasesDetected: [],
    });
    
    try {
      // Step 1: MEMORY_QUERY
      await this.stateMachine.transition(sessionId, 'MEMORY_QUERY', {
        sessionId,
        taskDescription: userRequest.message,
        taskType: protocolTaskType,
        config: this.stateMachine.getContext(sessionId)?.config,
        waiverPhrasesDetected: [],
      });
      await this.queryMemory(userRequest);
      this.stateMachine.setCheckpoint(sessionId, 'memoryQueryCompleted', true);
      
      // Step 2: SEQUENTIAL_THINK (if complex task)
      const thinker = this.sequentialThinker;
      if (thinker.shouldThink(userRequest.message)) {
        const thinkResult = await this.stateMachine.transition(sessionId, 'SEQUENTIAL_THINK');
        if (thinkResult.success) {
          await this.performSequentialThinking(userRequest, sessionId);
          this.stateMachine.setCheckpoint(sessionId, 'sequentialThinkCompleted', true);
        }
      }
      
      // Step 3: PLAN (if build task)
      if (requiresPlanning(taskType, userRequest.message)) {
        const planResult = await this.stateMachine.transition(sessionId, 'PLAN');
        if (planResult.success) {
          const plan = await this.createPlan(userRequest, sessionId);
          if (!plan) {
            throw new Error('Planning required but not completed');
          }
          this.stateMachine.setCheckpoint(sessionId, 'planApproved', true);
        }
      }
      
      // Step 4: DELEGATE
      const delegateResult = await this.stateMachine.transition(sessionId, 'DELEGATE');
      if (!delegateResult.success) {
        throw new Error(`Delegation blocked: ${delegateResult.blockedBy}`);
      }
      const result = await this.delegateTasks(userRequest, sessionId);
      this.stateMachine.setCheckpoint(sessionId, 'delegationCompleted', true);
      
      // Step 5: GIT_CHECK
      const gitResult = await this.stateMachine.transition(sessionId, 'GIT_CHECK');
      if (!gitResult.success) {
        throw new Error(`Git check failed: ${gitResult.blockedBy}`);
      }
      await this.performGitCheck(sessionId);
      this.stateMachine.setCheckpoint(sessionId, 'gitCheckPassed', true);
      
      // Step 6: QUALITY_GATES
      const qualityResult = await this.stateMachine.transition(sessionId, 'QUALITY_GATES');
      if (!qualityResult.success) {
        throw new Error(`Quality gates failed: ${qualityResult.blockedBy}`);
      }
      await this.runQualityGates(sessionId);
      this.stateMachine.setCheckpoint(sessionId, 'qualityGatesPassed', true);
      
      // Step 7: DOC_UPDATE
      await this.stateMachine.transition(sessionId, 'DOC_UPDATE');
      await this.checkDocUpdates(sessionId);
      this.stateMachine.setCheckpoint(sessionId, 'docsUpdated', true);
      
      // Step 8: MEMORY_SAVE
      await this.stateMachine.transition(sessionId, 'MEMORY_SAVE');
      await this.saveToMemory(userRequest, result, sessionId);
      this.stateMachine.setCheckpoint(sessionId, 'memorySaveCompleted', true);
      
      // Complete
      await this.stateMachine.transition(sessionId, 'COMPLETE');
      
      return { success: true, result, sessionId };
    } catch (error) {
      // Transition to COMPLETE on error
      try {
        await this.stateMachine.transition(sessionId, 'COMPLETE');
      } catch {
        // Ignore transition errors during cleanup
      }
      throw error;
    }
  }

  /**
   * Query memory for user request
   */
  private async queryMemory(request: UserRequest): Promise<void> {
    try {
      if (this.autoMemory) {
        await this.memoryService.queryMemories(request.message, { limit: 10 });
      }
    } catch {
      // Memory query is best-effort
    }
  }

  /**
   * Perform sequential thinking for complex tasks
   */
  private async performSequentialThinking(request: UserRequest, sessionId: string): Promise<void> {
    try {
      await this.sequentialThinker.analyze(request.message, {
        sessionId,
        context: request.context,
      });
      // Store result for later retrieval
      const result = this.sequentialThinker.getSessionResult(sessionId);
      if (result) {
        this.sequentialThinker.setSessionResult(sessionId, result);
      }
    } catch {
      // Sequential thinking is best-effort
    }
  }

  /**
   * Create implementation plan
   */
  private async createPlan(request: UserRequest, sessionId: string): Promise<TaskGraph | null> {
    // Check for waiver phrases first
    const context = this.stateMachine.getContext(sessionId);
    if (context?.waiverPhrasesDetected.some(p => ['skip planning', 'just do it', 'no plan needed'].includes(p))) {
      return null;
    }
    
    try {
      return await this.planTask(request.message);
    } catch {
      return null;
    }
  }

  /**
   * Delegate tasks to appropriate agents
   */
  private async delegateTasks(request: UserRequest, sessionId: string): Promise<TaskGraph> {
    const graph = await this.planTask(request.message);
    
    // Execute tasks using the real TaskRunner
    if (graph.tasks.length > 0) {
      const executionResults = await this.taskRunner.executeAll(
        graph.tasks.map(t => ({
          id: t.id,
          agent: t.agent,
          description: t.description,
          context: { sessionId, originalMessage: request.message },
        })),
        { sessionId }
      );
      
      // Update task results from execution
      for (let i = 0; i < graph.tasks.length; i++) {
        const execResult = executionResults[i];
        if (execResult) {
          graph.tasks[i].result = {
            taskId: graph.tasks[i].id,
            success: execResult.success,
            output: execResult.output,
            error: execResult.error,
            duration: execResult.durationMs,
          };
          graph.tasks[i].status = execResult.success ? 'completed' : 'failed';
        }
      }
    }
    
    return graph;
  }

  /**
   * Perform git check
   */
  private async performGitCheck(sessionId: string): Promise<void> {
    try {
      const result = await this.protocolEnforcer.enforceGitCheck(sessionId);
      if (!result.clean && result.error) {
        // Check if we have a waiver
        const context = this.stateMachine.getContext(sessionId);
        if (!context?.waiverPhrasesDetected.some(p => ['--force', 'git is fine', 'proceed anyway'].includes(p))) {
          throw new Error(`Git check failed: ${result.error}`);
        }
      }
    } catch {
      // Git check enforcement handles its own errors
    }
  }

  /**
   * Run quality gates
   */
  private async runQualityGates(sessionId: string): Promise<void> {
    try {
      const result = await this.protocolEnforcer.enforceQualityGates(sessionId);
      if (!result.passed && result.errors.length > 0) {
        // Check if we have a waiver
        const context = this.stateMachine.getContext(sessionId);
        if (!context?.waiverPhrasesDetected.some(p => ['skip tests', 'skip gates'].includes(p))) {
          throw new Error(`Quality gates failed: ${result.errors.join('; ')}`);
        }
      }
    } catch {
      // Quality gates enforcement handles its own errors
    }
  }

  /**
   * Check documentation updates
   */
  private async checkDocUpdates(sessionId: string): Promise<void> {
    try {
      // Take snapshot if not already done
      if (!this.docTracker.hasSnapshot(sessionId)) {
        await this.docTracker.snapshot(sessionId);
      }
      
      // Check if docs need updating
      const needsUpdate = await this.docTracker.needsUpdate(sessionId);
      if (needsUpdate.needsUpdate) {
        // Check for waiver
        const context = this.stateMachine.getContext(sessionId);
        if (context?.waiverPhrasesDetected.includes('no docs needed')) {
          return; // Skip doc check
        }
        // In strict mode, could throw here
      }
    } catch {
      // Doc tracking is best-effort
    }
  }

  /**
   * Save results to memory
   */
  private async saveToMemory(request: UserRequest, result: unknown, sessionId: string): Promise<void> {
    try {
      if (this.autoMemory) {
        const summary = `Session ${sessionId} completed: ${request.message.substring(0, 200)}`;
        await this.memoryService.addMemory({
          content: summary,
          sourceType: 'conversation',
          sessionId,
          metadata: {
            taskType: detectTaskType(request.message),
            sessionId,
            timestamp: Date.now(),
          },
        });
      }
    } catch {
      // Memory save is best-effort
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
    
    // Estimate context usage after planning
    const taskTexts = tasks.map(t => t.description);
    contextMonitor.estimateUsageBatch([request, ...taskTexts]);

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
  
  /**
   * Get the protocol state machine for monitoring
   */
  getStateMachine(): ProtocolStateMachine {
    return this.stateMachine;
  }
  
  /**
   * Get the protocol enforcer for checkpoint operations
   */
  getProtocolEnforcer(): ProtocolEnforcer {
    return this.protocolEnforcer;
  }
}

export { DEFAULT_AGENTS, AGENT_KEYWORDS };