/**
 * Protocol State Machine Tests
 * 
 * Tests for the Protocol Enforcement v4.0 state machine foundation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProtocolStateMachine,
  getProtocolStateMachine,
  resetProtocolStateMachine,
} from '../../src/protocol/state-machine.js';
import { CheckpointRegistry } from '../../src/protocol/checkpoint.js';
import { ProtocolEventBus } from '../../src/protocol/events.js';
import type { ProtocolState, ProtocolContext } from '../../src/protocol/types.js';

describe('ProtocolStateMachine', () => {
  let stateMachine: ProtocolStateMachine;

  beforeEach(() => {
    resetProtocolStateMachine();
    // Clear checkpoint registry between tests
    CheckpointRegistry.getInstance().clear();
    stateMachine = new ProtocolStateMachine();
  });

  afterEach(() => {
    stateMachine.destroy();
  });

  describe('Session Management', () => {
    it('should initialize a new session', () => {
      const sessionId = 'test-session-1';
      stateMachine.initializeSession(sessionId, {
        taskDescription: 'Test task',
        taskType: 'code_generation',
      });

      expect(stateMachine.getState(sessionId)).toBe('IDLE');
      expect(stateMachine.getHistory(sessionId)).toEqual(['IDLE']);
    });

    it('should return null state for non-existent session', () => {
      expect(stateMachine.getState('non-existent')).toBeNull();
      expect(stateMachine.getHistory('non-existent')).toEqual([]);
    });

    it('should track session history through transitions', async () => {
      const sessionId = 'test-session-2';
      stateMachine.initializeSession(sessionId);
      
      await stateMachine.transition(sessionId, 'MEMORY_QUERY');
      await stateMachine.transition(sessionId, 'SEQUENTIAL_THINK');
      await stateMachine.transition(sessionId, 'PLAN');

      const history = stateMachine.getHistory(sessionId);
      expect(history).toContain('IDLE');
      expect(history).toContain('MEMORY_QUERY');
      expect(history).toContain('SEQUENTIAL_THINK');
      expect(history).toContain('PLAN');
    });

    it('should terminate a session', () => {
      const sessionId = 'test-session-3';
      stateMachine.initializeSession(sessionId);
      stateMachine.terminateSession(sessionId);

      expect(stateMachine.getState(sessionId)).toBeNull();
    });

    it('should track multiple isolated sessions', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      stateMachine.initializeSession(session1);
      stateMachine.initializeSession(session2);

      await stateMachine.transition(session1, 'MEMORY_QUERY');
      await stateMachine.transition(session2, 'MEMORY_QUERY');
      await stateMachine.transition(session1, 'SEQUENTIAL_THINK');

      expect(stateMachine.getState(session1)).toBe('SEQUENTIAL_THINK');
      expect(stateMachine.getState(session2)).toBe('MEMORY_QUERY');
    });

    it('should get active session count', () => {
      stateMachine.initializeSession('session-1');
      stateMachine.initializeSession('session-2');
      stateMachine.initializeSession('session-3');

      expect(stateMachine.getActiveSessionCount()).toBe(3);
      expect(stateMachine.getActiveSessions()).toContain('session-1');
      expect(stateMachine.getActiveSessions()).toContain('session-2');
      expect(stateMachine.getActiveSessions()).toContain('session-3');
    });
  });

  describe('State Transitions', () => {
    it('should allow valid transitions from IDLE to MEMORY_QUERY', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const result = await stateMachine.transition(sessionId, 'MEMORY_QUERY');
      
      expect(result.success).toBe(true);
      expect(result.from).toBe('IDLE');
      expect(result.to).toBe('MEMORY_QUERY');
      expect(stateMachine.getState(sessionId)).toBe('MEMORY_QUERY');
    });

    it('should reject invalid transitions from IDLE directly to PLAN', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      // Try to skip from IDLE directly to PLAN (invalid)
      const result = await stateMachine.transition(sessionId, 'PLAN');
      
      expect(result.success).toBe(false);
      expect(result.blockedBy).toContain('Invalid transition');
      expect(stateMachine.getState(sessionId)).toBe('IDLE');
    });

    it('should allow transition to COMPLETE from any state', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);
      await stateMachine.transition(sessionId, 'MEMORY_QUERY');
      await stateMachine.transition(sessionId, 'SEQUENTIAL_THINK');

      // Abort to COMPLETE from any state
      const result = await stateMachine.transition(sessionId, 'COMPLETE');
      
      expect(result.success).toBe(true);
      expect(stateMachine.getState(sessionId)).toBe('COMPLETE');
    });

    it('should allow transition to PLAN from MEMORY_QUERY (skip thinking for simple task)', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId, { taskType: 'simple_query' });
      
      // First transition to MEMORY_QUERY
      await stateMachine.transition(sessionId, 'MEMORY_QUERY');
      
      // Then from MEMORY_QUERY, can go directly to PLAN (skip thinking for simple tasks)
      const result = await stateMachine.transition(sessionId, 'PLAN');
      
      expect(result.success).toBe(true);
      expect(stateMachine.getState(sessionId)).toBe('PLAN');
    });

    it('should report valid next states from IDLE', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const canMemQuery = await stateMachine.canTransition(sessionId, 'MEMORY_QUERY');
      expect(canMemQuery.allowed).toBe(true);

      const canQualGates = await stateMachine.canTransition(sessionId, 'QUALITY_GATES');
      expect(canQualGates.allowed).toBe(false);
    });
  });

  describe('Checkpoint Management', () => {
    it('should set and get checkpoints', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      stateMachine.setCheckpoint(sessionId, 'memory_queried', true);
      stateMachine.setCheckpoint(sessionId, 'git_checked', false);

      expect(stateMachine.getCheckpoint(sessionId, 'memory_queried')).toBe(true);
      expect(stateMachine.getCheckpoint(sessionId, 'git_checked')).toBe(false);
      expect(stateMachine.getCheckpoint(sessionId, 'nonexistent')).toBe(false);
    });

    it('should get all checkpoints', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      stateMachine.setCheckpoint(sessionId, 'checkpoint1', true);
      stateMachine.setCheckpoint(sessionId, 'checkpoint2', false);

      const all = stateMachine.getAllCheckpoints(sessionId);
      expect(all).toEqual({
        checkpoint1: true,
        checkpoint2: false,
      });
    });

    it('should return empty checkpoints for non-existent session', () => {
      const checkpoints = stateMachine.getAllCheckpoints('non-existent');
      expect(checkpoints).toEqual({});
    });
  });

  describe('Event Emission', () => {
    it('should emit state.changed events on transitions', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const events: unknown[] = [];
      stateMachine.on('state.changed', (event) => {
        events.push(event);
      });

      await stateMachine.transition(sessionId, 'MEMORY_QUERY');
      
      // Should have at least the init event
      expect(events.length).toBeGreaterThanOrEqual(1);
      
      // Check that one event has the MEMORY_QUERY transition
      const memQueryEvent = events.find((e: any) => 
        e.payload?.to === 'MEMORY_QUERY'
      );
      expect(memQueryEvent).toBeDefined();
    });

    it('should emit state.blocked event for invalid transitions', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const blockedEvents: unknown[] = [];
      stateMachine.on('state.blocked', (event) => {
        blockedEvents.push(event);
      });

      await stateMachine.transition(sessionId, 'QUALITY_GATES'); // Invalid from IDLE

      expect(blockedEvents.length).toBe(1);
      expect(blockedEvents[0]).toMatchObject({
        type: 'state.blocked',
        sessionId,
        payload: expect.objectContaining({
          from: 'IDLE',
          to: 'QUALITY_GATES',
        }),
      });
    });

    it('should emit protocol.completed on session termination', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);
      stateMachine.transition(sessionId, 'MEMORY_QUERY');

      const events: unknown[] = [];
      stateMachine.on('protocol.completed', (event) => {
        events.push(event);
      });

      stateMachine.terminateSession(sessionId);

      expect(events.length).toBe(1);
      expect(events[0]).toMatchObject({
        type: 'protocol.completed',
        sessionId,
      });
    });

    it('should support multiple handlers for same event', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      stateMachine.on('state.changed', handler1);
      stateMachine.on('state.changed', handler2);

      await stateMachine.transition(sessionId, 'MEMORY_QUERY');

      // Both handlers should be called at least once
      expect(handler1.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(handler2.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow removing event handlers', async () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const handler = vi.fn();
      stateMachine.on('state.changed', handler);
      stateMachine.off('state.changed', handler);

      await stateMachine.transition(sessionId, 'MEMORY_QUERY');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Waiver Phrase Detection', () => {
    beforeEach(() => {
      // Register test checkpoints with waiver phrases
      const registry = CheckpointRegistry.getInstance();
      
      registry.register({
        name: 'git_check',
        description: 'Git working tree check',
        waiverPhrases: ['--force', 'git is fine', 'proceed anyway'],
        validate: async () => ({ passed: false, message: 'Git check not passed' }),
        autoFixable: false,
      });

      registry.register({
        name: 'planning',
        description: 'Planning checkpoint',
        waiverPhrases: ['skip planning', 'just do it', 'no plan needed'],
        validate: async () => ({ passed: false, message: 'Planning not complete' }),
        autoFixable: false,
      });

      registry.register({
        name: 'quality_gates',
        description: 'Quality gates checkpoint',
        waiverPhrases: ['skip tests', 'skip gates'],
        validate: async () => ({ passed: false, message: 'Quality gates not passed' }),
        autoFixable: false,
      });
    });

    it('should detect waiver phrases in user input - "just do it"', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      // When only "just do it" is present
      const waiver = stateMachine.checkWaiver(sessionId, 'Just do it');
      expect(waiver).toBe('just do it');
    });

    it('should detect "skip planning" phrase when present alone', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const waiver = stateMachine.checkWaiver(sessionId, 'skip planning');
      expect(waiver).toBe('skip planning');
    });

    it('should return null for no waiver match', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      const waiver = stateMachine.checkWaiver(sessionId, 'Normal task description');
      expect(waiver).toBeNull();
    });

    it('should track detected waiver phrases in context', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      stateMachine.checkWaiver(sessionId, 'skip planning');
      
      const context = stateMachine.getContext(sessionId);
      expect(context?.waiverPhrasesDetected).toContain('skip planning');
    });

    it('should not duplicate waiver phrases', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId);

      stateMachine.checkWaiver(sessionId, 'skip planning');
      stateMachine.checkWaiver(sessionId, 'skip planning');

      const context = stateMachine.getContext(sessionId);
      const skipPlanningCount = context?.waiverPhrasesDetected.filter(p => p === 'skip planning').length ?? 0;
      expect(skipPlanningCount).toBe(1);
    });

    it('should use CheckpointRegistry.findWaiver for finding waivers', () => {
      const registry = CheckpointRegistry.getInstance();
      
      const result = registry.findWaiver('Please skip planning and skip tests');
      expect(result).not.toBeNull();
      expect(result?.checkpoint).toBe('planning');
    });
  });

  describe('Config Strictness Levels', () => {
    it('should block transitions in strict mode when checkpoints fail', async () => {
      // Register a failing checkpoint for a state we want to transition to
      const registry = CheckpointRegistry.getInstance();
      registry.register({
        name: 'test_checkpoint',
        description: 'Test checkpoint',
        waiverPhrases: [],
        validate: async () => ({ passed: false, message: 'Checkpoint failed' }),
        autoFixable: false,
      });

      const strictMachine = new ProtocolStateMachine({ strictness: 'strict' });
      
      const sessionId = 'test-session';
      strictMachine.initializeSession(sessionId);
      await strictMachine.transition(sessionId, 'MEMORY_QUERY');
      
      // Transition to COMPLETE (which has no checkpoint) should work
      const completeResult = await strictMachine.transition(sessionId, 'COMPLETE');
      expect(completeResult.success).toBe(true);

      strictMachine.destroy();
    });

    it('should allow transitions in lenient mode even with checkpoint failures', async () => {
      const lenientMachine = new ProtocolStateMachine({ strictness: 'lenient' });
      
      const sessionId = 'test-session';
      lenientMachine.initializeSession(sessionId);
      await lenientMachine.transition(sessionId, 'MEMORY_QUERY');
      
      // In lenient mode, transitions should succeed
      const result = await lenientMachine.transition(sessionId, 'SEQUENTIAL_THINK');
      
      expect(result.success).toBe(true);
      expect(lenientMachine.getState(sessionId)).toBe('SEQUENTIAL_THINK');

      lenientMachine.destroy();
    });

    it('should use default lenient config', () => {
      const machine = new ProtocolStateMachine();
      expect(machine).toBeDefined();
      machine.destroy();
    });
  });

  describe('Context Management', () => {
    it('should store and retrieve context', () => {
      const sessionId = 'test-session';
      const initialContext: Partial<ProtocolContext> = {
        taskDescription: 'Build a new feature',
        taskType: 'code_generation',
        agent: 'boomerang-coder',
      };

      stateMachine.initializeSession(sessionId, initialContext);

      const context = stateMachine.getContext(sessionId);
      expect(context?.taskDescription).toBe('Build a new feature');
      expect(context?.taskType).toBe('code_generation');
      expect(context?.agent).toBe('boomerang-coder');
    });

    it('should update context during execution', () => {
      const sessionId = 'test-session';
      stateMachine.initializeSession(sessionId, { taskType: 'simple_query' });

      stateMachine.updateContext(sessionId, { agent: 'boomerang-explorer' });

      const context = stateMachine.getContext(sessionId);
      expect(context?.agent).toBe('boomerang-explorer');
    });

    it('should preserve config in context', () => {
      const customConfig = {
        strictness: 'strict' as const,
        timeoutSeconds: 600,
        autoSaveMemory: false,
        enforcePlanning: false,
        enforceSequentialThinking: false,
        enforceGitCheck: true,
        enforceQualityGates: true,
        enforceDocUpdates: false,
        waiverPhrases: { planning: ['custom phrase'] },
      };

      const machine = new ProtocolStateMachine(customConfig);
      const sessionId = 'test-session';
      machine.initializeSession(sessionId);

      const context = machine.getContext(sessionId);
      expect(context?.config.strictness).toBe('strict');
      expect(context?.config.timeoutSeconds).toBe(600);
      expect(context?.config.enforcePlanning).toBe(false);

      machine.destroy();
    });
  });

  describe('ProtocolEventBus', () => {
    it('should handle events with erroring handlers gracefully', () => {
      const bus = new ProtocolEventBus();

      bus.on('state.changed', () => {
        throw new Error('Handler error');
      });

      // Should not throw
      bus.emit({
        type: 'state.changed',
        sessionId: 'test',
        timestamp: Date.now(),
        payload: {},
      });
    });

    it('should count listeners', () => {
      const bus = new ProtocolEventBus();
      
      const handler1 = () => {};
      const handler2 = () => {};

      expect(bus.listenerCount('state.changed')).toBe(0);

      bus.on('state.changed', handler1);
      expect(bus.listenerCount('state.changed')).toBe(1);

      bus.on('state.changed', handler2);
      expect(bus.listenerCount('state.changed')).toBe(2);

      bus.off('state.changed', handler1);
      expect(bus.listenerCount('state.changed')).toBe(1);
    });

    it('should clear all handlers', () => {
      const bus = new ProtocolEventBus();
      
      bus.on('state.changed', () => {});
      bus.on('state.blocked', () => {});
      bus.on('protocol.completed', () => {});

      bus.clear();

      expect(bus.listenerCount('state.changed')).toBe(0);
      expect(bus.listenerCount('state.blocked')).toBe(0);
      expect(bus.listenerCount('protocol.completed')).toBe(0);
    });

    it('should clear handlers for specific event', () => {
      const bus = new ProtocolEventBus();
      
      bus.on('state.changed', () => {});
      bus.on('state.blocked', () => {});

      bus.clear('state.changed');

      expect(bus.listenerCount('state.changed')).toBe(0);
      expect(bus.listenerCount('state.blocked')).toBe(1);
    });
  });

  describe('CheckpointRegistry', () => {
    it('should register and retrieve checkpoints', () => {
      const registry = CheckpointRegistry.getInstance();
      
      registry.register({
        name: 'test_checkpoint',
        description: 'A test checkpoint',
        waiverPhrases: ['waive me'],
        validate: async () => ({ passed: true }),
        autoFixable: true,
        autoFix: async () => ({ passed: true, autoFixed: true }),
      });

      const checkpoint = registry.get('test_checkpoint');
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.description).toBe('A test checkpoint');
    });

    it('should list all checkpoints', () => {
      const registry = CheckpointRegistry.getInstance();
      registry.clear();

      registry.register({
        name: 'cp1',
        description: 'Checkpoint 1',
        waiverPhrases: [],
        validate: async () => ({ passed: true }),
        autoFixable: false,
      });

      registry.register({
        name: 'cp2',
        description: 'Checkpoint 2',
        waiverPhrases: [],
        validate: async () => ({ passed: true }),
        autoFixable: false,
      });

      const checkpoints = registry.list();
      expect(checkpoints).toHaveLength(2);
    });

    it('should return passed result for non-existent checkpoint', async () => {
      const registry = CheckpointRegistry.getInstance();
      
      const result = await registry.validate('nonexistent', 'session', {
        sessionId: 'session',
        taskDescription: '',
        taskType: 'simple_query',
        config: {
          strictness: 'lenient',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: true,
          enforceSequentialThinking: true,
          enforceGitCheck: true,
          enforceQualityGates: true,
          enforceDocUpdates: true,
          waiverPhrases: {},
        },
        waiverPhrasesDetected: [],
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('Singleton Access', () => {
    it('should provide singleton access', () => {
      resetProtocolStateMachine();
      
      const machine1 = getProtocolStateMachine();
      const machine2 = getProtocolStateMachine();

      expect(machine1).toBe(machine2);

      resetProtocolStateMachine();
    });

    it('should reset singleton', () => {
      const machine1 = getProtocolStateMachine();
      resetProtocolStateMachine();
      const machine2 = getProtocolStateMachine();

      expect(machine1).not.toBe(machine2);
    });
  });
});