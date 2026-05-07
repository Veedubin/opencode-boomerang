/**
 * BoomerangOrchestrator - Pure Decision Layer
 * 
 * Does NOT execute agents or spawn subprocesses.
 * Instead, analyzes requests and returns Context Packages for OpenCode to execute.
 * 
 * Responsibilities:
 * 1. Query memory for context
 * 2. Detect task type from user request
 * 3. Detect independent subtasks for parallel execution
 * 4. Select appropriate agent(s)
 * 5. Build complete Context Package(s)
 * 6. Return { agent, prompt, context } or { tasks } for OpenCode's native execution
 */

import { getMemorySystem, type MemorySystem } from './memory/index.js';
import { loadAgents, type AgentDefinition } from './asset-loader.js';
import type { MemoryEntry } from './memory/schema.js';
import type { OrchestrationResult, ContextPackage, TaskPlan } from './protocol/types.js';

// Task type detection keywords (more specific first)
const TASK_KEYWORDS: Record<string, string[]> = {
  code: ['code', 'implement', 'create', 'add', 'build', 'make', 'fix', 'refactor'],
  test: ['test', 'testing', 'verify', 'check', 'validate', 'spec'],
  explore: ['explore', 'find', 'search', 'locate', 'discover', 'grep', 'glob'],
  review: ['review', 'analyze', 'assess', 'evaluate', 'architect'],
  write: ['doc', 'documentation', 'readme', 'md', 'write', 'update'],
  git: ['git', 'commit', 'push', 'branch', 'merge', 'pull', 'checkout', 'tag'],
  release: ['release', 'publish', 'version', 'bump', 'changelog'],
  scraper: ['scrape', 'fetch', 'web', 'search', 'research'],
};

const AGENT_FOR_TASK: Record<string, string> = {
  code: 'boomerang-coder',
  test: 'boomerang-tester',
  explore: 'boomerang-explorer',
  review: 'boomerang-architect',
  write: 'boomerang-writer',
  git: 'boomerang-git',
  release: 'boomerang-release',
  scraper: 'boomerang-scraper',
};

const COMPLEX_PATTERNS = /implement|create|design|architecture|refactor|migration|complex|multiple|stripe/i;
const THINKING_TRIGGERS = /think through|analyze|plan this|design|architecture|refactor/i;

/**
 * BoomerangOrchestrator - Pure decision layer for OpenCode integration
 * 
 * Returns context packages, NOT execution results. OpenCode executes agents natively.
 */
export class BoomerangOrchestrator {
  private agents: AgentDefinition[];
  private memorySystem: MemorySystem;

  constructor() {
    this.agents = loadAgents();
    this.memorySystem = getMemorySystem();
  }

  /**
   * Main orchestration entry point
   * Analyze request, query memory, build context package, return for OpenCode execution
   */
  async orchestrate(request: string): Promise<OrchestrationResult> {
    // Step 1: Query memory for relevant context
    const memories = await this.queryMemory(request);
    
    // Step 2: Check for parallel task opportunities
    const subtasks = this.extractSubtasks(request);
    
    // Step 3: If multiple independent subtasks detected, use parallel orchestration
    const hasParallelPotential = subtasks.length > 1 && subtasks.some(s => !s.isSequential);
    
    if (hasParallelPotential) {
      return this.orchestrateWithParallelTasks(request, memories);
    }
    
    // Step 4: Legacy single-agent orchestration
    const taskType = this.detectTaskType(request);
    const agent = this.selectAgent(taskType);
    const contextPackage = this.buildContextPackage(request, taskType, agent, memories);
    
    return {
      agent: agent.name,
      systemPrompt: agent.systemPrompt || '',
      contextPackage,
      suggestions: {
        useSequentialThinking: this.isComplexTask(request),
        runQualityGates: taskType === 'code',
      },
    };
  }

  /**
   * Query memories for relevant context
   */
  private async queryMemory(request: string): Promise<MemoryEntry[]> {
    try {
      if (!this.memorySystem.isInitialized()) {
        return [];
      }
      const results = await this.memorySystem.search(request, { topK: 10 });
      return results.map(r => r.entry);
    } catch {
      return [];
    }
  }

  /**
   * Detect task type from request keywords
   */
  private detectTaskType(request: string): string {
    const lower = request.toLowerCase();
    
    // Check keywords in priority order
    for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return taskType;
        }
      }
    }
    
    return 'code'; // Default to code generation
  }

  /**
   * Select agent based on task type
   */
  private selectAgent(taskType: string): AgentDefinition {
    const agentName = AGENT_FOR_TASK[taskType] || 'boomerang';
    const agent = this.agents.find(a => a.name === agentName);
    
    if (agent) {
      return agent;
    }
    
    // Fallback to boomerang general agent
    const fallback = this.agents.find(a => a.name === 'boomerang');
    return fallback || {
      name: 'boomerang',
      description: 'General purpose agent',
      systemPrompt: '',
      skills: [],
    };
  }

  /**
   * Build complete Context Package
   */
  private buildContextPackage(
    request: string,
    taskType: string,
    agent: AgentDefinition,
    memories: MemoryEntry[]
  ): ContextPackage {
    // Extract relevant files from memory
    const relevantFiles = this.extractFilePaths(memories);
    
    // Extract previous decisions from memory context
    const previousDecisions = this.extractDecisions(memories);
    
    return {
      originalUserRequest: request,
      taskBackground: this.generateTaskBackground(taskType, request),
      relevantFiles,
      codeSnippets: this.extractCodeSnippets(memories),
      previousDecisions,
      expectedOutput: this.generateExpectedOutput(taskType),
      scopeBoundaries: this.generateScopeBoundaries(taskType),
      errorHandling: 'Report errors clearly with file paths and line numbers. Do not crash silently.',
    };
  }

  /**
   * Extract file paths from memory entries
   */
  private extractFilePaths(memories: MemoryEntry[]): string[] {
    const paths = new Set<string>();
    for (const memory of memories) {
      if (memory.sourcePath && memory.sourcePath.startsWith('file://')) {
        paths.add(memory.sourcePath.replace('file://', ''));
      }
    }
    return Array.from(paths).slice(0, 20);
  }

  /**
   * Extract decision context from memories
   */
  private extractDecisions(memories: MemoryEntry[]): string[] {
    const decisions: string[] = [];
    for (const memory of memories.slice(0, 5)) {
      const content = memory.text;
      if (content.includes('decided') || content.includes('chose') || content.includes('implemented')) {
        decisions.push(content.substring(0, 200));
      }
    }
    return decisions;
  }

  /**
   * Extract code snippets from memories
   */
  private extractCodeSnippets(memories: MemoryEntry[]): string[] {
    const snippets: string[] = [];
    for (const memory of memories) {
      const content = memory.text;
      const codeBlockMatch = content.match(/```[\s\S]*?```/g);
      if (codeBlockMatch) {
        snippets.push(...codeBlockMatch.slice(0, 3));
      }
    }
    return snippets.slice(0, 5);
  }

  /**
   * Generate task background text
   */
  private generateTaskBackground(taskType: string, request: string): string {
    return `Task type: ${taskType}\nUser request: ${request.substring(0, 500)}`;
  }

  /**
   * Generate expected output description
   */
  private generateExpectedOutput(taskType: string): string {
    const outputs: Record<string, string> = {
      code: 'Working code with tests passing',
      test: 'Test files with coverage',
      explore: 'File paths and code locations',
      review: 'Analysis with recommendations',
      write: 'Updated documentation',
      git: 'Git operations completed',
      release: 'Published package with changelog',
      scraper: 'Gathered data and sources',
    };
    return outputs[taskType] || 'Task completed successfully';
  }

  /**
   * Generate scope boundaries
   */
  private generateScopeBoundaries(taskType: string): { inScope: string[]; outOfScope: string[] } {
    const scopes: Record<string, { inScope: string[]; outOfScope: string[] }> = {
      code: {
        inScope: ['Implementation', 'Unit tests', 'Documentation updates'],
        outOfScope: ['Major architecture changes', 'Database migrations', 'Performance optimization'],
      },
      test: {
        inScope: ['Test files', 'Test coverage', 'Integration tests'],
        outOfScope: ['Implementation changes', 'Production deployment'],
      },
      explore: {
        inScope: ['File discovery', 'Pattern search', 'Code analysis'],
        outOfScope: ['Code modifications', 'File creation'],
      },
    };
    return scopes[taskType] || { inScope: ['Task execution'], outOfScope: ['Unrelated changes'] };
  }

  /**
   * Determine if task requires sequential thinking
   */
  private isComplexTask(request: string): boolean {
    return COMPLEX_PATTERNS.test(request) || 
           THINKING_TRIGGERS.test(request) || 
           request.length > 500;
  }

  /**
   * Parse request for parallel conjunctions vs sequential markers
   */
  private extractSubtasks(request: string): { text: string; isSequential: boolean }[] {
    // Sequential markers: "then", "after", "once done", "when done", "after that", "next"
    const sequentialMarkers = /\b(then|after|once\s+done|when\s+done|after\s+that|next|before|afterwards)\b/i;
    
    // Parallel conjunctions: "and", "plus", "also", "both", "simultaneously"
    const parallelMarkers = /\b(and|plus|also|both|simultaneously|while)\b/i;
    
    // Split on sequential markers first to identify chunks
    const parts = request.split(sequentialMarkers);
    
    const subtasks: { text: string; isSequential: boolean }[] = [];
    let currentSequential = false;
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      if (sequentialMarkers.test(trimmed)) {
        currentSequential = true;
        continue;
      }
      
      // Check if this part has parallel markers (subtasks within this chunk)
      if (parallelMarkers.test(trimmed)) {
        // Split by parallel markers
        const parallelParts = trimmed.split(parallelMarkers);
        for (const p of parallelParts) {
          const pTrimmed = p.trim();
          if (pTrimmed) {
            subtasks.push({ text: pTrimmed, isSequential: currentSequential });
          }
        }
      } else {
        subtasks.push({ text: trimmed, isSequential: currentSequential });
      }
      
      currentSequential = true; // After encountering sequential marker, subsequent parts are sequential
    }
    
    return subtasks.filter(s => s.text.length > 5);
  }

  /**
   * Build a task plan for a single subtask
   */
  private buildTaskPlan(
    id: string,
    subtaskText: string,
    memories: MemoryEntry[],
    dependencies: string[] = []
  ): TaskPlan {
    const taskType = this.detectTaskType(subtaskText);
    const agentName = AGENT_FOR_TASK[taskType] || 'boomerang-coder';
    const agent = this.agents.find(a => a.name === agentName) || this.agents.find(a => a.name === 'boomerang')!;
    
    const contextPackage: ContextPackage = {
      originalUserRequest: subtaskText,
      taskBackground: `Subtask from parallel execution. Task type: ${taskType}`,
      relevantFiles: this.extractFilePaths(memories).slice(0, 10),
      codeSnippets: this.extractCodeSnippets(memories).slice(0, 3),
      previousDecisions: this.extractDecisions(memories).slice(0, 3),
      expectedOutput: this.generateExpectedOutput(taskType),
      scopeBoundaries: this.generateScopeBoundaries(taskType),
      errorHandling: 'Report errors clearly with file paths and line numbers. Do not crash silently.',
    };
    
    return {
      id,
      agent: agentName,
      description: subtaskText,
      contextPackage,
      dependencies,
      priority: 'medium',
      canParallelize: true,
    };
  }

  /**
   * Orchestrate with parallel task support
   */
  private orchestrateWithParallelTasks(request: string, memories: MemoryEntry[]): OrchestrationResult {
    const subtasks = this.extractSubtasks(request);
    
    // If only one subtask or all are sequential, use legacy single-agent mode
    if (subtasks.length <= 1 || subtasks.every(s => s.isSequential)) {
      return this.orchestrateSingle(request, memories);
    }
    
    // Group subtasks that can run in parallel
    // Sequential ones form boundaries between parallel groups
    const tasks: TaskPlan[] = [];
    let taskId = 0;
    let currentDependencies: string[] = [];
    
    for (const subtask of subtasks) {
      if (subtask.isSequential) {
        // Start a new sequential group - dependencies are all previous tasks
        currentDependencies = tasks.map(t => t.id);
      }
      
      const plan = this.buildTaskPlan(
        `task-${++taskId}`,
        subtask.text,
        memories,
        currentDependencies
      );
      plan.canParallelize = !subtask.isSequential;
      plan.dependencies = currentDependencies;
      tasks.push(plan);
    }
    
    // Mark tasks that can run in parallel (no dependencies on each other within their group)
    // For simplicity, if all dependencies are met and no sequential markers, all can parallelize
    const hasSequential = subtasks.some(s => s.isSequential);
    if (!hasSequential) {
      for (const task of tasks) {
        task.canParallelize = true;
        task.dependencies = [];
      }
    }
    
    return {
      tasks,
      suggestions: {
        useSequentialThinking: this.isComplexTask(request),
        runQualityGates: true,
      },
    };
  }

  /**
   * Legacy single-agent orchestration
   */
  private orchestrateSingle(request: string, memories: MemoryEntry[]): OrchestrationResult {
    const taskType = this.detectTaskType(request);
    const agent = this.selectAgent(taskType);
    const contextPackage = this.buildContextPackage(request, taskType, agent, memories);
    
    return {
      agent: agent.name,
      systemPrompt: agent.systemPrompt || '',
      contextPackage,
      suggestions: {
        useSequentialThinking: this.isComplexTask(request),
        runQualityGates: taskType === 'code',
      },
    };
  }
}

/**
 * Factory function to create orchestrator
 */
export function createOrchestrator(): BoomerangOrchestrator {
  return new BoomerangOrchestrator();
}
