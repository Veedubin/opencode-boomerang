/**
 * Protocol Tracker (DEPRECATED)
 * 
 * @deprecated Use ProtocolStateMachine from './state-machine.js' instead.
 * This module is kept for backward compatibility but will be removed in a future version.
 * 
 * The new ProtocolStateMachine provides:
 * - Real state machine with explicit state transitions
 * - Checkpoint validation before state transitions
 * - Event-driven architecture via ProtocolEventBus
 * - Session isolation and automatic cleanup
 * - Waiver phrase detection
 * 
 * Migration Guide:
 * - Instead of: `protocolTracker.getOrCreateSession(sessionId)`
 * - Use: `stateMachine.initializeSession(sessionId)`
 * 
 * - Instead of: `protocolTracker.recordToolCall(sessionId, toolName, args)`
 * - Use: State machine handles this automatically via checkpoints
 */

import type { ProtocolState } from './types.js';

// Re-export for backward compatibility
export interface ProtocolCheckpoint {
  memoryQueried: boolean;
  sequentialThinkingUsed: boolean;
  memorySaved: boolean;
  gitChecked: boolean;
  qualityGatesRun: boolean;
  codeChangesMade: boolean;
}

export interface ToolCallRecord {
  toolName: string;
  timestamp: number;
  args: Record<string, unknown>;
}

/**
 * @deprecated Use ProtocolStateMachine instead
 */
export class ProtocolTracker {
  private sessions = new Map<string, {
    checkpoints: ProtocolCheckpoint;
    toolCalls: ToolCallRecord[];
    startTime: number;
    lastActivity: number;
  }>();

  /**
   * @deprecated Use ProtocolStateMachine.initializeSession() instead
   */
  getOrCreateSession(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        checkpoints: {
          memoryQueried: false,
          sequentialThinkingUsed: false,
          memorySaved: false,
          gitChecked: false,
          qualityGatesRun: false,
          codeChangesMade: false,
        },
        toolCalls: [],
        startTime: Date.now(),
        lastActivity: Date.now(),
      });
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * @deprecated Use ProtocolStateMachine transitions and checkpoints instead
   */
  recordToolCall(sessionId: string, toolName: string, args: Record<string, unknown>) {
    const session = this.getOrCreateSession(sessionId);
    session.toolCalls.push({ toolName, timestamp: Date.now(), args });
    session.lastActivity = Date.now();

    if (toolName.includes('query_memories') || toolName.includes('search_project')) {
      session.checkpoints.memoryQueried = true;
    }
    if (toolName.includes('sequential')) {
      session.checkpoints.sequentialThinkingUsed = true;
    }
    if (toolName.includes('add_memory') || toolName.includes('save')) {
      session.checkpoints.memorySaved = true;
    }
    if (toolName.includes('git')) {
      session.checkpoints.gitChecked = true;
    }
  }

  /**
   * @deprecated Use ProtocolStateMachine.getCheckpoint() instead
   */
  getCheckpoints(sessionId: string): ProtocolCheckpoint {
    return this.getOrCreateSession(sessionId).checkpoints;
  }

  /**
   * @deprecated Use ProtocolStateMachine.setCheckpoint() instead
   */
  markCodeChanges(sessionId: string) {
    this.getOrCreateSession(sessionId).checkpoints.codeChangesMade = true;
  }

  /**
   * @deprecated Use ProtocolStateMachine.setCheckpoint() instead
   */
  markQualityGatesRun(sessionId: string) {
    this.getOrCreateSession(sessionId).checkpoints.qualityGatesRun = true;
  }

  /**
   * @deprecated Use ProtocolStateMachine.terminateSession() instead
   */
  clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  /**
   * @deprecated Use ProtocolStateMachine transitions instead
   */
  recordInternalToolCall(toolName: string, args: Record<string, unknown>) {
    this.recordToolCall('system', toolName, args);
  }
}

/**
 * @deprecated Use ProtocolStateMachine from './state-machine.js' instead
 */
export const protocolTracker = new ProtocolTracker();

/**
 * Helper function to convert old ProtocolTracker checkpoints to new state machine format
 * @deprecated This is for migration support only
 */
export function migrateCheckpoints(sessionId: string, stateMachine: { setCheckpoint: (id: string, name: string, val: boolean) => void; getCheckpoints: (id: string) => ProtocolCheckpoint }): void {
  const checkpoints = protocolTracker.getCheckpoints(sessionId);
  stateMachine.setCheckpoint(sessionId, 'memoryQueried', checkpoints.memoryQueried);
  stateMachine.setCheckpoint(sessionId, 'sequentialThinkingUsed', checkpoints.sequentialThinkingUsed);
  stateMachine.setCheckpoint(sessionId, 'memorySaved', checkpoints.memorySaved);
  stateMachine.setCheckpoint(sessionId, 'gitChecked', checkpoints.gitChecked);
  stateMachine.setCheckpoint(sessionId, 'qualityGatesRun', checkpoints.qualityGatesRun);
  stateMachine.setCheckpoint(sessionId, 'codeChangesMade', checkpoints.codeChangesMade);
}