/**
 * Protocol State Machine Foundation
 * 
 * Defines shared types for the Boomerang Protocol Enforcement v4.0
 */

/**
 * Valid protocol states representing each step in the Boomerang Protocol
 */
export type ProtocolState = 
  | 'IDLE' 
  | 'MEMORY_QUERY' 
  | 'SEQUENTIAL_THINK' 
  | 'PLAN' 
  | 'DELEGATE' 
  | 'GIT_CHECK' 
  | 'QUALITY_GATES' 
  | 'DOC_UPDATE' 
  | 'MEMORY_SAVE' 
  | 'COMPLETE';

/**
 * Task type classification for protocol enforcement decisions
 */
export type TaskType = 'code_generation' | 'testing' | 'documentation' | 'research' | 'bug_fix' | 'refactoring' | 'migration' | 'simple_query';

/**
 * Context passed through protocol execution
 */
export interface ProtocolContext {
  sessionId: string;
  taskDescription: string;
  taskType: TaskType;
  agent?: string;
  config: ProtocolConfig;
  waiverPhrasesDetected: string[];
}

/**
 * Protocol configuration options
 */
export interface ProtocolConfig {
  strictness: 'strict' | 'standard' | 'lenient';
  timeoutSeconds: number;
  autoSaveMemory: boolean;
  enforcePlanning: boolean;
  enforceSequentialThinking: boolean;
  enforceGitCheck: boolean;
  enforceQualityGates: boolean;
  enforceDocUpdates: boolean;
  waiverPhrases: Record<string, string[]>;
}

/**
 * Result of checkpoint validation
 */
export interface CheckpointResult {
  passed: boolean;
  message?: string;
  autoFixed?: boolean;
  waiverUsed?: string;
}

/**
 * Result of a state transition attempt
 */
export interface TransitionResult {
  success: boolean;
  from: ProtocolState;
  to: ProtocolState;
  blockedBy?: string;
  autoFixed?: boolean;
}

/**
 * Session state stored in the state machine
 */
export interface SessionState {
  state: ProtocolState;
  checkpoints: Map<string, boolean>;
  history: ProtocolState[];
  createdAt: number;
  lastActivity: number;
  context: ProtocolContext;
}

/**
 * Canonical Agent definition for agent metadata
 */
export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
}

/**
 * Session tracking for protocol checkpoint migration
 */
export interface ProtocolCheckpoint {
  memoryQueried: boolean;
  sequentialThinkingUsed: boolean;
  memorySaved: boolean;
  gitChecked: boolean;
  qualityGatesRun: boolean;
  codeChangesMade: boolean;
}

/**
 * Tool call record for tracking
 */
export interface ToolCallRecord {
  toolName: string;
  timestamp: number;
  args: Record<string, unknown>;
}

/**
 * Session data for tool call tracking (used by migrated code)
 */
export interface SessionData {
  checkpoints: ProtocolCheckpoint;
  toolCalls: ToolCallRecord[];
  startTime: number;
  lastActivity: number;
}