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

export class ProtocolTracker {
  private sessions = new Map<string, {
    checkpoints: ProtocolCheckpoint;
    toolCalls: ToolCallRecord[];
    startTime: number;
    lastActivity: number;
  }>();

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

  getCheckpoints(sessionId: string): ProtocolCheckpoint {
    return this.getOrCreateSession(sessionId).checkpoints;
  }

  markCodeChanges(sessionId: string) {
    this.getOrCreateSession(sessionId).checkpoints.codeChangesMade = true;
  }

  markQualityGatesRun(sessionId: string) {
    this.getOrCreateSession(sessionId).checkpoints.qualityGatesRun = true;
  }

  clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}

export const protocolTracker = new ProtocolTracker();