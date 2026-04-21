/**
 * Boomerang Protocol - Core Type Definitions
 */

// Embedding Strategy
/**
 * Memory search strategies:
 * - TIERED = "Fast Reply" mode: MiniLM first, BGE fallback on misses (speed-focused)
 * - PARALLEL = "Archivist" mode: Both tiers searched with RRF fusion (recall-focused)
 */
export type EmbeddingStrategy = "TIERED" | "PARALLEL";

// Memory Tier Configuration
export interface MemoryTierConfig {
  strategy: EmbeddingStrategy;
  bgeThreshold: number;
  autoSummarizeInterval: number;
  miniLMDimensions: number;
  bgeDimensions: number;
}

// Enhanced Memory Entry with tier metadata
export interface MemoryEntry {
  id: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  sourceModel?: "minilm" | "bge-large"; // track which embedding model
  tier?: "transient" | "permanent";    // memory tier classification
  project?: string;                      // project tag
  metadata?: Record<string, any>;        // key-value metadata
}

// Search result with confidence score
export interface MemorySearchResult {
  success: boolean;
  results?: MemoryEntry[];
  error?: string;
  strategy?: EmbeddingStrategy;          // which strategy was used
  tierSearched?: ("minilm" | "bge")[];  // which tiers were searched
  confidence?: number;                   // top result confidence
}

// RRF (Reciprocal Rank Fusion) result
export interface RRFResult {
  entry: MemoryEntry;
  score: number;
  sourceTier: "minilm" | "bge";
  originalRank: number;
}

// Save long result
export interface MemorySaveLongResult {
  success: boolean;
  id?: string;
  error?: string;
  embeddingModel?: "bge-large";
  dimensions?: number;
}

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
  memoryTierConfig: MemoryTierConfig;    // tier config for memory
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
