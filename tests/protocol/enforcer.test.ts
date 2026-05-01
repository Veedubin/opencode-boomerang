/**
 * ProtocolEnforcer Tests
 * 
 * Tests for the rewritten ProtocolEnforcer with CheckpointRegistry integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProtocolEnforcer, getProtocolEnforcer, resetProtocolEnforcer } from '../../src/protocol/enforcer.js';
import { CheckpointRegistry } from '../../src/protocol/checkpoint.js';
import { ProtocolContext } from '../../src/protocol/types.js';

describe('ProtocolEnforcer', () => {
  let enforcer: ProtocolEnforcer;

  beforeEach(() => {
    // Reset singleton before each test
    resetProtocolEnforcer();
    const registry = CheckpointRegistry.getInstance();
    registry.clear();
    
    enforcer = new ProtocolEnforcer({
      enforceMemoryQuery: true,
      enforceSequentialThinking: true,
      enforceMemorySave: true,
      enforceGitCheck: true,
      enforceQualityGates: true,
      autoFix: true,
    });
  });

  afterEach(() => {
    resetProtocolEnforcer();
    CheckpointRegistry.getInstance().clear();
  });

  describe('checkpoint registration', () => {
    it('should register all built-in checkpoints when validateForState is called', async () => {
      const registry = CheckpointRegistry.getInstance();
      
      // Before calling validateForState, no checkpoints should be registered
      // (except from previous test runs that may have initialized a singleton)
      registry.clear();

      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Simple task',
        taskType: 'simple_query',
        config: {
          strictness: 'lenient',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: false,
          waiverPhrases: {},
        },
        waiverPhrasesDetected: [],
      };

      // This triggers initialization
      await enforcer.validateForState('IDLE', 'test-session', ctx);

      const checkpoints = registry.list();
      
      // Should have registered memoryQueryCompleted
      expect(checkpoints.find(c => c.name === 'memoryQueryCompleted')).toBeDefined();
      
      // Should have registered sequentialThinkCompleted
      expect(checkpoints.find(c => c.name === 'sequentialThinkCompleted')).toBeDefined();
      
      // Should have registered planApproved
      expect(checkpoints.find(c => c.name === 'planApproved')).toBeDefined();
      
      // Should have registered delegationCompleted
      expect(checkpoints.find(c => c.name === 'delegationCompleted')).toBeDefined();
      
      // Should have registered gitCheckPassed
      expect(checkpoints.find(c => c.name === 'gitCheckPassed')).toBeDefined();
      
      // Should have registered qualityGatesPassed
      expect(checkpoints.find(c => c.name === 'qualityGatesPassed')).toBeDefined();
      
      // Should have registered docsUpdated
      expect(checkpoints.find(c => c.name === 'docsUpdated')).toBeDefined();
      
      // Should have registered memorySaveCompleted
      expect(checkpoints.find(c => c.name === 'memorySaveCompleted')).toBeDefined();
    });

    it('should register checkpoint with correct properties', async () => {
      const registry = CheckpointRegistry.getInstance();
      registry.clear();

      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Simple task',
        taskType: 'simple_query',
        config: {
          strictness: 'lenient',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: false,
          waiverPhrases: {},
        },
        waiverPhrasesDetected: [],
      };

      // Trigger initialization
      await enforcer.validateForState('IDLE', 'test-session', ctx);

      const checkpoint = registry.get('memoryQueryCompleted');
      
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.name).toBe('memoryQueryCompleted');
      expect(checkpoint!.description).toBeDefined();
      expect(checkpoint!.autoFixable).toBe(true);
      expect(checkpoint!.validate).toBeDefined();
    });

    it('should register checkpoint with waiver phrases', async () => {
      const registry = CheckpointRegistry.getInstance();
      registry.clear();

      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Simple task',
        taskType: 'simple_query',
        config: {
          strictness: 'lenient',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: false,
          waiverPhrases: {},
        },
        waiverPhrasesDetected: [],
      };

      // Trigger initialization
      await enforcer.validateForState('IDLE', 'test-session', ctx);

      const checkpoint = registry.get('sequentialThinkCompleted');
      
      expect(checkpoint!.waiverPhrases).toContain('no thinking needed');
      expect(checkpoint!.waiverPhrases).toContain('skip thinking');
    });
  });

  describe('validateForState', () => {
    it('should return passed=true for empty checkpoint list', async () => {
      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Simple task',
        taskType: 'simple_query',
        config: {
          strictness: 'lenient',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: false,
          waiverPhrases: {},
        },
        waiverPhrasesDetected: [],
      };

      const result = await enforcer.validateForState('IDLE', 'test-session', ctx);
      
      expect(result.passed).toBe(true);
    });

    it('should detect waiver phrases and waive checkpoints', async () => {
      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'This task needs skip planning to be done',
        taskType: 'code_generation',
        config: {
          strictness: 'strict',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: true,
          enforceSequentialThinking: true,
          enforceGitCheck: true,
          enforceQualityGates: true,
          enforceDocUpdates: true,
          waiverPhrases: {
            planning: ['skip planning', 'just do it'],
          },
        },
        waiverPhrasesDetected: [],
      };

      const result = await enforcer.validateForState('PLAN', 'test-session', ctx);
      
      // Should be waived, not failed
      expect(result.waived.length).toBeGreaterThan(0);
    });
  });

  describe('waiver phrase detection', () => {
    it('should detect skip thinking waiver', async () => {
      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Implement this feature, skip thinking is fine',
        taskType: 'code_generation',
        config: {
          strictness: 'strict',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: true,
          enforceSequentialThinking: true,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: false,
          waiverPhrases: {
            sequentialThinking: ['no thinking needed', 'skip thinking'],
          },
        },
        waiverPhrasesDetected: [],
      };

      const result = await enforcer.validateForState('SEQUENTIAL_THINK', 'test-session', ctx);
      
      expect(result.waived.some(w => w.includes('skip thinking'))).toBe(true);
    });

    it('should detect skip tests waiver', async () => {
      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Just do it skip tests',
        taskType: 'code_generation',
        config: {
          strictness: 'strict',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: true,
          enforceDocUpdates: false,
          waiverPhrases: {
            qualityGates: ['skip tests', 'skip gates'],
          },
        },
        waiverPhrasesDetected: [],
      };

      const result = await enforcer.validateForState('QUALITY_GATES', 'test-session', ctx);
      
      expect(result.waived.some(w => w.includes('skip tests'))).toBe(true);
    });

    it('should detect no docs needed waiver', async () => {
      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Quick fix, no docs needed',
        taskType: 'bug_fix',
        config: {
          strictness: 'strict',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: true,
          waiverPhrases: {
            docUpdates: ['no docs needed'],
          },
        },
        waiverPhrasesDetected: [],
      };

      const result = await enforcer.validateForState('DOC_UPDATE', 'test-session', ctx);
      
      expect(result.waived.some(w => w.includes('no docs needed'))).toBe(true);
    });
  });

  describe('autoFix behavior', () => {
    it('should validate checkpoint registration', async () => {
      // Simple test to verify checkpoint was registered
      const registry = CheckpointRegistry.getInstance();
      registry.clear();

      const ctx: ProtocolContext = {
        sessionId: 'test-session',
        taskDescription: 'Simple task',
        taskType: 'simple_query',
        config: {
          strictness: 'lenient',
          timeoutSeconds: 300,
          autoSaveMemory: true,
          enforcePlanning: false,
          enforceSequentialThinking: false,
          enforceGitCheck: false,
          enforceQualityGates: false,
          enforceDocUpdates: false,
          waiverPhrases: {},
        },
        waiverPhrasesDetected: [],
      };

      // Trigger initialization
      await enforcer.validateForState('IDLE', 'test-session', ctx);

      // Verify memoryQueryCompleted checkpoint was registered
      const checkpoint = registry.get('memoryQueryCompleted');
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.autoFixable).toBe(true);
    });
  });

  describe('getRegistry', () => {
    it('should return the checkpoint registry', () => {
      const reg = enforcer.getRegistry();
      expect(reg).toBeDefined();
      expect(reg).toBeInstanceOf(CheckpointRegistry);
    });
  });

  describe('getDocTracker', () => {
    it('should return the doc tracker', () => {
      const tracker = enforcer.getDocTracker();
      expect(tracker).toBeDefined();
    });
  });
});

describe('ProtocolEnforcer singleton', () => {
  afterEach(() => {
    resetProtocolEnforcer();
    CheckpointRegistry.getInstance().clear();
  });

  it('should return same instance via getProtocolEnforcer', () => {
    const enforcer1 = getProtocolEnforcer();
    const enforcer2 = getProtocolEnforcer();
    
    expect(enforcer1).toBe(enforcer2);
  });

  it('should reset singleton via resetProtocolEnforcer', () => {
    const enforcer1 = getProtocolEnforcer();
    resetProtocolEnforcer();
    const enforcer2 = getProtocolEnforcer();
    
    expect(enforcer1).not.toBe(enforcer2);
  });
});

describe('CheckpointRegistry integration', () => {
  afterEach(() => {
    CheckpointRegistry.getInstance().clear();
  });

  it('should allow registering custom checkpoints', () => {
    const registry = CheckpointRegistry.getInstance();
    
    registry.register({
      name: 'customCheckpoint',
      description: 'A custom checkpoint',
      autoFixable: false,
      waiverPhrases: ['custom waiver'],
      validate: async () => ({ passed: true }),
    });
    
    const checkpoint = registry.get('customCheckpoint');
    expect(checkpoint).toBeDefined();
    expect(checkpoint!.name).toBe('customCheckpoint');
  });

  it('should allow unregistering checkpoints', () => {
    const registry = CheckpointRegistry.getInstance();
    
    registry.register({
      name: 'tempCheckpoint',
      description: 'Temporary',
      autoFixable: false,
      waiverPhrases: [],
      validate: async () => ({ passed: true }),
    });
    
    registry.unregister('tempCheckpoint');
    
    const checkpoint = registry.get('tempCheckpoint');
    expect(checkpoint).toBeUndefined();
  });
});
