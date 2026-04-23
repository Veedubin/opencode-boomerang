/**
 * Boomerang Protocol - Core Type Definitions
 */

// Execution Configuration
/**
 * Execution Configuration
 * Controls safety limits for agent task execution.
 */
export interface ExecutionConfig {
  maxIterations: number;              // default: 15
  maxExecutionDepth: number;          // default: 5
  maxExecutionTimeMs: number;         // default: 120000 (2 minutes)
  loopDetectionWindow: number;        // default: 5 (recent outputs to track)
  loopSimilarityThreshold: number;    // default: 0.9 (90%)
  earlyStoppingEnabled: boolean;      // default: true
}

/**
 * Default execution configuration.
 */
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxIterations: 15,
  maxExecutionDepth: 5,
  maxExecutionTimeMs: 120000,
  loopDetectionWindow: 5,
  loopSimilarityThreshold: 0.9,
  earlyStoppingEnabled: true,
};

/**
 * Guard Result — returned by execution guard checks.
 */
export interface GuardResult {
  allowed: boolean;
  reason?: string;
  guardType: "depth" | "iterations" | "loop" | "timeout" | "none";
}

/**
 * Execution Record — audit trail for each task execution.
 */
export interface ExecutionRecord {
  taskId: string;
  agent: AgentType;
  startedAt: number;
  completedAt: number;
  iterations: number;
  stoppedEarly: boolean;
  stopReason?: string;
}

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
  executionConfig?: ExecutionConfig;     // optional execution config
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
  stoppedEarly?: boolean;             // true if guard triggered
  stopReason?: string;               // why it stopped
  iterationsUsed?: number;           // how many iterations consumed
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
  executionDepth: number;             // current nesting depth
  executionHistory: ExecutionRecord[]; // audit trail
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

// ==================== Memory Client Types (MCP) ====================

/**
 * Configuration for MemoryClient connection to Super-Memory-TS
 */
export interface MemoryClientConfig {
  /** Command to run the server (default: 'bun') */
  serverCommand?: string;
  /** Arguments for the server command */
  serverArgs?: string[];
  /** Working directory for the server process */
  serverCwd?: string;
  /** Connection timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Memory entry from Super-Memory-TS (MCP protocol)
 */
export interface McpMemoryEntry {
  id: string;
  text: string;
  sourceType: "session" | "file" | "web" | "boomerang" | "project";
  sourcePath?: string;
  timestamp: Date;
  metadataJson?: string;
}

/**
 * Project search result from Super-Memory-TS
 */
export interface ProjectSearchResult {
  chunk: {
    id: string;
    filePath: string;
    content: string;
    chunkIndex: number;
    totalChunks: number;
    fileType: string;
    lineStart: number;
    lineEnd: number;
  };
  score: number;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Query memories result
 */
export interface QueryResult {
  success: boolean;
  results?: McpMemoryEntry[];
  error?: string;
}

/**
 * Add memory result
 */
export interface AddMemoryResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Search project result
 */
export interface SearchProjectResult {
  success: boolean;
  results?: ProjectSearchResult[];
  error?: string;
}

/**
 * Index project result
 */
export interface IndexProjectResult {
  success: boolean;
  filesIndexed?: number;
  error?: string;
}
