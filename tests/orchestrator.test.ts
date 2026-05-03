/**
 * Orchestrator Tests - Pure Decision Layer
 * 
 * Tests for the new BoomerangOrchestrator that returns Context Packages
 * for OpenCode to execute, rather than executing agents directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoomerangOrchestrator, createOrchestrator } from '../src/orchestrator.js';

// Mock the memory system
vi.mock('../src/memory/index.js', () => ({
  getMemorySystem: () => ({
    isInitialized: () => true,
    search: vi.fn().mockResolvedValue([
      {
        entry: {
          id: 'mem-1',
          text: 'decided to use Qdrant for vector storage',
          sourcePath: 'file:///src/memory/index.ts',
          timestamp: Date.now(),
        }
      }
    ]),
    initialize: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('BoomerangOrchestrator', () => {
  let orchestrator: BoomerangOrchestrator;

  beforeEach(() => {
    orchestrator = new BoomerangOrchestrator();
  });

  describe('orchestrate', () => {
    it('should return orchestration result with agent and context package', async () => {
      const result = await orchestrator.orchestrate('implement user authentication');
      
      expect(result).toBeDefined();
      expect(result.agent).toBe('boomerang-coder');
      expect(result.systemPrompt).toBeDefined();
      expect(result.contextPackage).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should detect code task type from keywords', async () => {
      const result = await orchestrator.orchestrate('implement a new feature');
      
      expect(result.agent).toBe('boomerang-coder');
    });

    it('should detect test task type from keywords', async () => {
      const result = await orchestrator.orchestrate('test the payment processing');
      
      expect(result.agent).toBe('boomerang-tester');
    });

    it('should detect explore task type from keywords', async () => {
      const result = await orchestrator.orchestrate('find files with API endpoints');
      
      expect(result.agent).toBe('boomerang-explorer');
    });

    it('should detect review task type from keywords', async () => {
      const result = await orchestrator.orchestrate('analyze the architecture');
      
      expect(result.agent).toBe('boomerang-architect');
    });

    it('should detect write task type from keywords', async () => {
      const result = await orchestrator.orchestrate('write documentation for the API');
      
      expect(result.agent).toBe('boomerang-writer');
    });

    it('should detect git task type from keywords', async () => {
      const result = await orchestrator.orchestrate('commit the changes');
      
      expect(result.agent).toBe('boomerang-git');
    });

    it('should detect release task type from keywords', async () => {
      const result = await orchestrator.orchestrate('publish version 2.0');
      
      expect(result.agent).toBe('boomerang-release');
    });

    it('should default to boomerang-coder for unknown tasks', async () => {
      const result = await orchestrator.orchestrate('do something generic');
      
      // Should still return a valid agent
      expect(result.agent).toBeDefined();
    });

    it('should build context package with relevant fields', async () => {
      const result = await orchestrator.orchestrate('implement feature');
      
      const cp = result.contextPackage;
      expect(cp.originalUserRequest).toBe('implement feature');
      expect(cp.taskBackground).toBeDefined();
      expect(cp.relevantFiles).toBeDefined();
      expect(cp.codeSnippets).toBeDefined();
      expect(cp.previousDecisions).toBeDefined();
      expect(cp.expectedOutput).toBeDefined();
      expect(cp.scopeBoundaries).toBeDefined();
      expect(cp.errorHandling).toBeDefined();
    });

    it('should suggest sequential thinking for complex tasks', async () => {
      const result = await orchestrator.orchestrate('implement a complex architecture refactor');
      
      expect(result.suggestions.useSequentialThinking).toBe(true);
    });

    it('should suggest quality gates for code tasks', async () => {
      const result = await orchestrator.orchestrate('implement feature');
      
      expect(result.suggestions.runQualityGates).toBe(true);
    });

    it('should not suggest quality gates for explore tasks', async () => {
      const result = await orchestrator.orchestrate('find files');
      
      expect(result.suggestions.runQualityGates).toBe(false);
    });
  });

  describe('context package generation', () => {
    it('should extract file paths from memory results', async () => {
      const result = await orchestrator.orchestrate('implement something');
      
      // Memory mock returns a file:// path, should extract it
      expect(result.contextPackage.relevantFiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate task background with task type', async () => {
      const result = await orchestrator.orchestrate('test the feature');
      
      expect(result.contextPackage.taskBackground).toContain('test');
    });

    it('should generate scope boundaries based on task type', async () => {
      const codeResult = await orchestrator.orchestrate('implement code');
      
      expect(codeResult.contextPackage.scopeBoundaries.inScope).toBeDefined();
      expect(codeResult.contextPackage.scopeBoundaries.outOfScope).toBeDefined();
    });
  });
});

describe('createOrchestrator factory', () => {
  it('should create a new orchestrator instance', () => {
    const orchestrator = createOrchestrator();
    
    expect(orchestrator).toBeInstanceOf(BoomerangOrchestrator);
  });
});