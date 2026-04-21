/**
 * Boomerang Protocol - Core Type Definitions
 */

// Plugin Configuration
export interface BoomerangConfig {
  orchestratorModel: string;
  coderModel: string;
  architectModel: string;
  testerModel: string;
  linterModel: string;
  gitCheckBeforeWork: boolean;
  gitCommitAfterWork: boolean;
  qualityGates: {
    lint: boolean;
    typecheck: boolean;
    test: boolean;
  };
  memoryEnabled: boolean;
  lazyCompactionEnabled: boolean;
  contextIsolationEnabled: boolean;
  toolResultEvictionThreshold: number;
  middlewareEnabled: boolean;
}

// Agent Types
export type AgentType = 
  | "orchestrator" 
  | "coder" 
  | "architect" 
  | "tester" 
  | "linter" 
  | "git" 
  | "explorer"
  | "writer"
  | "scraper";

// Task Definitions
export interface Task {
  id: string;
  description: string;
  agent: AgentType;
  status: "pending" | "in-progress" | "completed" | "failed";
  dependencies: string[];
  result?: string;
  error?: string;
}

export interface TaskWithAgent extends Task {
  agent: AgentType;
}

// DAG Structure
export interface DAG {
  tasks: TaskWithAgent[];
  edges: Array<{ from: string; to: string }>;
  totalTasks: number;
}

// Execution Plan
export interface ExecutionPhase {
  phase: number;
  type: "parallel" | "sequential";
  tasks: TaskWithAgent[];
}

export interface ExecutionPlan {
  dag: DAG;
  executionOrder: ExecutionPhase[];
  estimatedParallelism: number;
}

// Execution Results
export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export interface PhaseResult {
  phase: number;
  type: "parallel" | "sequential";
  results: TaskResult[];
  allSuccess: boolean;
}

export interface AggregatedResults {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  allPassed: boolean;
}

// Git
export interface GitStatus {
  isDirty: boolean;
  files: string[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface GitCommitResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

// Quality Gates
export interface QualityGate {
  name: string;
  command: string;
  enabled: boolean;
}

export interface QualityGateResult {
  gate: string;
  passed: boolean;
  output: string;
  error?: string;
}

export interface QualityGateSummary {
  allPassed: boolean;
  summary: string;
  results: QualityGateResult[];
}

// Memory
export interface MemoryEntry {
  id: string;
  content: string;
  tags?: string[];
  createdAt?: string;
}

export interface MemorySearchResult {
  success: boolean;
  results?: MemoryEntry[];
  error?: string;
}

export interface MemoryAddResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Session State
export interface AgentDecision {
  agent: string;
  summary: string;
  reasoning?: string;
  timestamp: string;
}

export interface SessionState {
  sessionId: string;
  dirty: boolean;
  completedTasks: Task[];
  pendingTasks: Task[];
  agentDecisions: AgentDecision[];
  createdAt: number;
  lastUsedAt: number;
  notes: Map<string, string>;
}

// Orchestrator Context
export interface OrchestratorContext {
  sessionId: string;
  directory: string;
  worktree?: string;
  client: any; // OpenCode client
}

// Plugin Context
export interface PluginContext {
  client: any;
  $: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>;
}

// Middleware
export type MiddlewareHook = 
  | "before_agent"
  | "after_agent" 
  | "wrap_model_call"
  | "wrap_tool_call";

export interface Middleware {
  name: string;
  hook: MiddlewareHook;
  execute: (context: any, next: () => Promise<any>) => Promise<any>;
}

// Context Isolation
export interface IsolatedResult {
  summary: string;
  details?: string;
  filePath?: string;
  wordCount: number;
}