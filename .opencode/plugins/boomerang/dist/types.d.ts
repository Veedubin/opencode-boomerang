/**
 * Boomerang Protocol - Core Type Definitions
 */
/**
 * Memory search strategies:
 * - TIERED = "Fast Reply" mode: MiniLM first, BGE fallback on misses (speed-focused)
 * - PARALLEL = "Archivist" mode: Both tiers searched with RRF fusion (recall-focused)
 */
export type EmbeddingStrategy = "TIERED" | "PARALLEL";
export interface MemoryTierConfig {
    strategy: EmbeddingStrategy;
    bgeThreshold: number;
    autoSummarizeInterval: number;
    miniLMDimensions: number;
    bgeDimensions: number;
}
export interface MemoryEntry {
    id: string;
    content: string;
    tags?: string[];
    createdAt?: string;
    sourceModel?: "minilm" | "bge-large";
    tier?: "transient" | "permanent";
    project?: string;
    metadata?: Record<string, any>;
}
export interface MemorySearchResult {
    success: boolean;
    results?: MemoryEntry[];
    error?: string;
    strategy?: EmbeddingStrategy;
    tierSearched?: ("minilm" | "bge")[];
    confidence?: number;
}
export interface RRFResult {
    entry: MemoryEntry;
    score: number;
    sourceTier: "minilm" | "bge";
    originalRank: number;
}
export interface MemorySaveLongResult {
    success: boolean;
    id?: string;
    error?: string;
    embeddingModel?: "bge-large";
    dimensions?: number;
}
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
    memoryTierConfig: MemoryTierConfig;
    lazyCompactionEnabled: boolean;
    contextIsolationEnabled: boolean;
    toolResultEvictionThreshold: number;
    middlewareEnabled: boolean;
}
export type AgentType = "orchestrator" | "coder" | "architect" | "tester" | "linter" | "git" | "explorer" | "writer" | "scraper";
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
export interface DAG {
    tasks: TaskWithAgent[];
    edges: Array<{
        from: string;
        to: string;
    }>;
    totalTasks: number;
}
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
export interface MemoryAddResult {
    success: boolean;
    id?: string;
    error?: string;
}
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
export interface OrchestratorContext {
    sessionId: string;
    directory: string;
    worktree?: string;
    client: any;
}
export interface PluginContext {
    client: any;
    $: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>;
}
export type MiddlewareHook = "before_agent" | "after_agent" | "wrap_model_call" | "wrap_tool_call";
export interface Middleware {
    name: string;
    hook: MiddlewareHook;
    execute: (context: any, next: () => Promise<any>) => Promise<any>;
}
export interface IsolatedResult {
    summary: string;
    details?: string;
    filePath?: string;
    wordCount: number;
}
//# sourceMappingURL=types.d.ts.map