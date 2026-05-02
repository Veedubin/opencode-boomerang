/**
 * Protocol State Machine
 * 
 * Core state machine that tracks protocol steps per session and validates
 * checkpoints before allowing state transitions. Part of Protocol Enforcement v4.0.
 */

import type {
  ProtocolState,
  ProtocolContext,
  ProtocolConfig,
  CheckpointResult,
  TransitionResult,
  SessionState,
} from './types.js';
import { ProtocolEventBus, createProtocolEvent } from './events.js';
import { createProtocolConfig, isBlocking, isWarning } from './config.js';
import { CheckpointRegistry } from './checkpoint.js';

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Record<ProtocolState, ProtocolState[]> = {
  IDLE: ['MEMORY_QUERY'],
  MEMORY_QUERY: ['SEQUENTIAL_THINK', 'PLAN'],
  SEQUENTIAL_THINK: ['PLAN'],
  PLAN: ['DELEGATE'],
  DELEGATE: ['GIT_CHECK'],
  GIT_CHECK: ['QUALITY_GATES'],
  QUALITY_GATES: ['DOC_UPDATE'],
  DOC_UPDATE: ['MEMORY_SAVE'],
  MEMORY_SAVE: ['COMPLETE'],
  COMPLETE: [], // Terminal state
};

/**
 * Terminal states that can transition to COMPLETE
 */
const TERMINAL_STATES: ProtocolState[] = ['COMPLETE'];

export class ProtocolStateMachine {
  private sessions: Map<string, SessionState> = new Map();
  private eventBus: ProtocolEventBus;
  private config: ProtocolConfig;
  private checkpointRegistry: CheckpointRegistry;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<ProtocolConfig>) {
    this.config = createProtocolConfig(config);
    this.eventBus = new ProtocolEventBus();
    this.checkpointRegistry = CheckpointRegistry.getInstance();
    this.startCleanupInterval();
  }

  /**
   * Start periodic session cleanup
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, SESSION_CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up sessions older than MAX_SESSION_AGE_MS
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > MAX_SESSION_AGE_MS) {
        this.sessions.delete(sessionId);
        this.eventBus.emit(createProtocolEvent(sessionId, 'protocol.error', {
          error: 'Session expired due to inactivity',
          previousState: session.state,
        }));
      }
    }
  }

  /**
   * Create a new session
   */
  initializeSession(sessionId: string, context?: Partial<ProtocolContext>): void {
    if (this.sessions.has(sessionId)) {
      // Session exists, just update activity
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = Date.now();
      return;
    }

    const now = Date.now();
    this.sessions.set(sessionId, {
      state: 'IDLE',
      checkpoints: new Map(),
      history: ['IDLE'],
      createdAt: now,
      lastActivity: now,
      context: {
        sessionId,
        taskDescription: context?.taskDescription ?? '',
        taskType: context?.taskType ?? 'simple_query',
        agent: context?.agent,
        config: this.config,
        waiverPhrasesDetected: [],
        ...context,
      },
    });

    this.eventBus.emit(createProtocolEvent(sessionId, 'state.changed', {
      from: null,
      to: 'IDLE',
    }));
  }

  /**
   * Terminate and clean up a session
   */
  terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.eventBus.emit(createProtocolEvent(sessionId, 'protocol.completed', {
        finalState: session.state,
        history: session.history,
        checkpoints: Object.fromEntries(session.checkpoints),
      }));
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Get current state for a session
   */
  getState(sessionId: string): ProtocolState | null {
    return this.sessions.get(sessionId)?.state ?? null;
  }

  /**
   * Get state history for a session
   */
  getHistory(sessionId: string): ProtocolState[] {
    return this.sessions.get(sessionId)?.history ?? [];
  }

  /**
   * Get session context
   */
  getContext(sessionId: string): ProtocolContext | null {
    return this.sessions.get(sessionId)?.context ?? null;
  }

  /**
   * Check if transition to a state is allowed
   */
  async canTransition(
    sessionId: string,
    to: ProtocolState
  ): Promise<{ allowed: boolean; reason?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    const from = session.state;

    // Allow transition to COMPLETE from any state (for error/abort cases)
    if (to === 'COMPLETE') {
      return { allowed: true };
    }

    // Check if transition is valid
    if (!this.validateTransition(from, to)) {
      const validNextStates = this.getNextStates(from);
      return {
        allowed: false,
        reason: `Invalid transition from ${from} to ${to}. Valid states: ${validNextStates.join(', ') || 'none'}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Transition to a new state
   */
  async transition(
    sessionId: string,
    to: ProtocolState,
    context?: Partial<ProtocolContext>
  ): Promise<TransitionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        from: 'IDLE',
        to,
        blockedBy: 'Session not found',
      };
    }

    const from = session.state;

    // Check if transition is valid
    const { allowed, reason } = await this.canTransition(sessionId, to);
    if (!allowed) {
      this.eventBus.emit(createProtocolEvent(sessionId, 'state.blocked', {
        from,
        to,
        reason,
      }));
      return {
        success: false,
        from,
        to,
        blockedBy: reason,
      };
    }

    // Run checkpoint validations before transition
    const checkpointResult = await this.runPreTransitionCheckpoints(sessionId, to);
    
    // Handle checkpoint failures based on strictness
    if (!checkpointResult.passed) {
      if (isBlocking(this.config.strictness)) {
        this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.failed', {
          checkpoint: checkpointResult.checkpointName,
          message: checkpointResult.message,
        }));
        return {
          success: false,
          from,
          to,
          blockedBy: checkpointResult.message,
        };
      } else if (isWarning(this.config.strictness)) {
        this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.failed', {
          checkpoint: checkpointResult.checkpointName,
          message: checkpointResult.message,
          warningOnly: true,
        }));
        // In lenient/standard mode, we allow transition but emit warning
      }
    }

    // Update session state
    session.state = to;
    session.lastActivity = Date.now();
    session.history.push(to);

    // Update context if provided
    if (context) {
      session.context = {
        ...session.context,
        ...context,
        config: this.config, // Always use machine's config
      };
    }

    // Emit state changed event
    this.eventBus.emit(createProtocolEvent(sessionId, 'state.changed', {
      from,
      to,
      checkpointResults: checkpointResult,
    }));

    return {
      success: true,
      from,
      to,
    };
  }

  /**
   * Run pre-transition checkpoint validations
   */
  private async runPreTransitionCheckpoints(
    sessionId: string,
    to: ProtocolState
  ): Promise<{ passed: boolean; checkpointName?: string; message?: string }> {
    // Map state to required checkpoint
    const checkpointForState: Record<string, string> = {
      GIT_CHECK: 'git_check',
      QUALITY_GATES: 'quality_gates',
      MEMORY_SAVE: 'memory_save',
      PLAN: 'planning',
    };

    const checkpointName = checkpointForState[to];
    if (!checkpointName) {
      return { passed: true };
    }

    const session = this.sessions.get(sessionId)!;
    const result = await this.checkpointRegistry.validate(
      checkpointName,
      sessionId,
      session.context
    );

    // Check for waivers
    if (!result.passed && result.waiverUsed) {
      session.context.waiverPhrasesDetected.push(result.waiverUsed);
      this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.waived', {
        checkpoint: checkpointName,
        waiverPhrase: result.waiverUsed,
      }));
      return { passed: true };
    }

    if (!result.passed) {
      return {
        passed: false,
        checkpointName,
        message: result.message,
      };
    }

    this.eventBus.emit(createProtocolEvent(sessionId, 'checkpoint.validated', {
      checkpoint: checkpointName,
      result,
    }));

    return { passed: true };
  }

  /**
   * Set a checkpoint value
   */
  setCheckpoint(sessionId: string, name: string, value: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.checkpoints.set(name, value);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get a checkpoint value
   */
  getCheckpoint(sessionId: string, name: string): boolean {
    return this.sessions.get(sessionId)?.checkpoints.get(name) ?? false;
  }

  /**
   * Get all checkpoints for a session
   */
  getAllCheckpoints(sessionId: string): Record<string, boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {};
    }
    return Object.fromEntries(session.checkpoints);
  }

  /**
   * Update session context
   */
  updateContext(sessionId: string, context: Partial<ProtocolContext>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = {
        ...session.context,
        ...context,
        config: this.config,
      };
      session.lastActivity = Date.now();
    }
  }

  /**
   * Add detected waiver phrase to context
   */
  addWaiverPhrase(sessionId: string, phrase: string): void {
    const session = this.sessions.get(sessionId);
    if (session && !session.context.waiverPhrasesDetected.includes(phrase)) {
      session.context.waiverPhrasesDetected.push(phrase);
    }
  }

  /**
   * Check if input contains waiver phrases for a checkpoint
   */
  checkWaiver(sessionId: string, userInput: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const waiver = this.checkpointRegistry.findWaiver(userInput);
    if (waiver) {
      this.addWaiverPhrase(sessionId, waiver.phrase);
      return waiver.phrase;
    }
    return null;
  }

  /**
   * Validate a state transition is allowed
   */
  private validateTransition(from: ProtocolState, to: ProtocolState): boolean {
    // Allow transition to COMPLETE from any state
    if (to === 'COMPLETE') return true;

    const validNextStates = VALID_TRANSITIONS[from];
    return validNextStates?.includes(to) ?? false;
  }

  /**
   * Get valid next states from current state
   */
  private getNextStates(from: ProtocolState): ProtocolState[] {
    return VALID_TRANSITIONS[from] ?? [];
  }

  /**
   * Register an event handler
   */
  on(event: Parameters<ProtocolEventBus['on']>[0], handler: Parameters<ProtocolEventBus['on']>[1]): void {
    this.eventBus.on(event, handler);
  }

  /**
   * Unregister an event handler
   */
  off(event: Parameters<ProtocolEventBus['off']>[0], handler: Parameters<ProtocolEventBus['off']>[1]): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Get the event bus for direct access
   */
  getEventBus(): ProtocolEventBus {
    return this.eventBus;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Destroy the state machine and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
    this.eventBus.clear();
  }
}

// Singleton instance for convenience
let defaultInstance: ProtocolStateMachine | null = null;

export function getProtocolStateMachine(config?: Partial<ProtocolConfig>): ProtocolStateMachine {
  if (!defaultInstance) {
    defaultInstance = new ProtocolStateMachine(config);
  }
  return defaultInstance;
}
export function resetProtocolStateMachine(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}
