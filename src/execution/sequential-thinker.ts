/**
 * Sequential Thinker
 * 
 * Abstraction for sequential thinking that works via MCP tool when available,
 * with local fallback implementation. Part of Protocol Enforcement v4.0.
 */

import { getMemoryService } from '../memory-service.js';

export interface ThinkingResult {
  completed: boolean;
  thoughts: string[];
  analysis: string;
  recommendations: string[];
}

export interface ThinkerConfig {
  useMcpTool: boolean;
  minTaskLength: number;
  complexityPatterns: RegExp[];
}

const DEFAULT_CONFIG: ThinkerConfig = {
  useMcpTool: true,
  minTaskLength: 100,
  complexityPatterns: [
    /implement|create|design|architecture|refactor|migration/i,
  ],
};

/**
 * Trigger phrases that indicate explicit thinking is needed
 */
const EXPLICIT_THINK_TRIGGERS = [
  'think through',
  'analyze',
  'plan this',
];

/**
 * Sequential thinking abstraction
 */
export class SequentialThinker {
  private config: ThinkerConfig;
  private mcpAvailable: boolean;
  private sessionThoughts: Map<string, ThinkingResult> = new Map();

  constructor(config?: Partial<ThinkerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mcpAvailable = this.checkMcpAvailability();
  }

  /**
   * Check if MCP tool is available
   */
  private checkMcpAvailability(): boolean {
    try {
      // Check if we have access to the MCP tool
      return typeof globalThis !== 'undefined' && 
        typeof (globalThis as any).mcp !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Determine if a task needs sequential thinking
   */
  shouldThink(taskDescription: string): boolean {
    const length = taskDescription.length;
    
    // Too short
    if (length < this.config.minTaskLength) {
      return false;
    }

    // Explicit trigger phrase
    const lowerDesc = taskDescription.toLowerCase();
    for (const trigger of EXPLICIT_THINK_TRIGGERS) {
      if (lowerDesc.includes(trigger)) {
        return true;
      }
    }

    // Matches complexity pattern
    for (const pattern of this.config.complexityPatterns) {
      if (pattern.test(taskDescription)) {
        return true;
      }
    }

    // Default threshold
    return length > this.config.minTaskLength * 2;
  }

  /**
   * Perform sequential thinking
   */
  async analyze(taskDescription: string, context?: unknown): Promise<ThinkingResult> {
    if (this.mcpAvailable && this.config.useMcpTool) {
      return this.mcpThink(taskDescription, context);
    }
    return this.localThink(taskDescription, context);
  }

  /**
   * MCP-based thinking via tool
   */
  private async mcpThink(taskDescription: string, context?: unknown): Promise<ThinkingResult> {
    try {
      // Use the sequential thinking tool if available
      const result = await (globalThis as any).mcp?.sequential_thinking?.({
        query: taskDescription,
        context: context ? JSON.stringify(context) : undefined,
      });

      if (result) {
        return {
          completed: true,
          thoughts: result.thoughts || [],
          analysis: result.analysis || '',
          recommendations: result.recommendations || [],
        };
      }
    } catch (error) {
      console.warn('[SequentialThinker] MCP tool failed, falling back to local:', error instanceof Error ? error.message : error);
    }

    return this.localThink(taskDescription, context);
  }

  /**
   * Local fallback implementation
   * Performs basic multi-step analysis without external tool
   */
  private async localThink(taskDescription: string, context?: unknown): Promise<ThinkingResult> {
    const thoughts: string[] = [];
    const recommendations: string[] = [];

    // Step 1: Decompose the task
    thoughts.push(`Analyzing task: "${taskDescription.substring(0, 50)}${taskDescription.length > 50 ? '...' : ''}"`);
    
    const wordCount = taskDescription.split(/\s+/).length;
    thoughts.push(`Task complexity: ${wordCount} words, ${taskDescription.length} characters`);

    // Step 2: Identify key components
    const keyTerms = this.extractKeyTerms(taskDescription);
    thoughts.push(`Key terms identified: ${keyTerms.join(', ')}`);

    // Step 3: Check memory for related context
    try {
      const memoryService = getMemoryService();
      if (memoryService.isInitialized() && !memoryService.isFallbackMode()) {
        const memories = await memoryService.queryMemories(taskDescription, { limit: 3 });
        if (memories.length > 0) {
          thoughts.push(`Found ${memories.length} related memory entries for context`);
        }
      }
    } catch {
      // Memory query failed, continue anyway
    }

    // Step 4: Generate recommendations based on task type
    if (/implement|create|build/i.test(taskDescription)) {
      recommendations.push('Consider using incremental implementation with tests first');
      recommendations.push('Verify dependencies before starting');
    }

    if (/design|architecture/i.test(taskDescription)) {
      recommendations.push('Document the design decisions and trade-offs');
      recommendations.push('Consider consulting the architect agent');
    }

    if (/refactor|migration/i.test(taskDescription)) {
      recommendations.push('Ensure backward compatibility when refactoring');
      recommendations.push('Create migration scripts if needed');
    }

    // Step 5: Create implementation analysis
    const analysis = this.generateAnalysis(taskDescription, keyTerms, context);

    return {
      completed: true,
      thoughts,
      analysis,
      recommendations,
    };
  }

  /**
   * Extract key terms from task description
   */
  private extractKeyTerms(taskDescription: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'we', 'they', 'it', 'not', 'as', 'if', 'then',
    ]);

    const words = taskDescription
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Get unique terms, preferring longer phrases
    const uniqueTerms = new Set<string>();
    const seen = new Set<string>();

    for (const word of words.reverse()) {
      if (!seen.has(word)) {
        uniqueTerms.add(word);
        seen.add(word);
        if (uniqueTerms.size >= 10) break;
      }
    }

    return Array.from(uniqueTerms);
  }

  /**
   * Generate analysis summary
   */
  private generateAnalysis(
    taskDescription: string,
    keyTerms: string[],
    context?: unknown
  ): string {
    const taskType = this.identifyTaskType(taskDescription);
    
    let analysis = `Task Type: ${taskType}\n`;
    analysis += `Key Components: ${keyTerms.slice(0, 5).join(', ')}\n`;

    if (context) {
      analysis += `Context Available: Yes\n`;
    }

    analysis += `\nApproach:\n`;
    
    if (taskType === 'code_generation' || taskType === 'implementation') {
      analysis += `1. Query relevant memories for prior solutions\n`;
      analysis += `2. Plan implementation steps\n`;
      analysis += `3. Implement incrementally with tests\n`;
      analysis += `4. Run quality gates\n`;
      analysis += `5. Update documentation\n`;
    } else if (taskType === 'refactoring') {
      analysis += `1. Analyze current implementation\n`;
      analysis += `2. Plan refactoring steps preserving behavior\n`;
      analysis += `3. Implement with test coverage\n`;
      analysis += `4. Verify quality gates pass\n`;
    } else if (taskType === 'documentation') {
      analysis += `1. Identify documents to update\n`;
      analysis += `2. Gather context from codebase\n`;
      analysis += `3. Update documentation\n`;
      analysis += `4. Verify consistency\n`;
    } else {
      analysis += `1. Gather relevant information\n`;
      analysis += `2. Analyze and synthesize findings\n`;
      analysis += `3. Present recommendations\n`;
    }

    return analysis;
  }

  /**
   * Identify the task type from description
   */
  private identifyTaskType(taskDescription: string): string {
    const lower = taskDescription.toLowerCase();
    
    if (/implement|create|add new|build/i.test(lower)) return 'code_generation';
    if (/test|spec/i.test(lower)) return 'testing';
    if (/doc|readme|comment/i.test(lower)) return 'documentation';
    if (/research|investigate|explore/i.test(lower)) return 'research';
    if (/fix|bug|patch/i.test(lower)) return 'bug_fix';
    if (/refactor|restructure|rewrite/i.test(lower)) return 'refactoring';
    if (/migrate|convert|port/i.test(lower)) return 'migration';
    
    return 'simple_query';
  }

  /**
   * Get stored thinking result for a session
   */
  getSessionResult(sessionId: string): ThinkingResult | null {
    return this.sessionThoughts.get(sessionId) || null;
  }

  /**
   * Store thinking result for a session
   */
  setSessionResult(sessionId: string, result: ThinkingResult): void {
    this.sessionThoughts.set(sessionId, result);
  }

  /**
   * Clear stored thinking for a session
   */
  clearSession(sessionId: string): void {
    this.sessionThoughts.delete(sessionId);
  }

  /**
   * Check if MCP tool is available
   */
  isMcpAvailable(): boolean {
    return this.mcpAvailable;
  }

  /**
   * Get the current configuration
   */
  getConfig(): ThinkerConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance
 */
let defaultInstance: SequentialThinker | null = null;

export function getSequentialThinker(config?: Partial<ThinkerConfig>): SequentialThinker {
  if (!defaultInstance) {
    defaultInstance = new SequentialThinker(config);
  }
  return defaultInstance;
}

export function resetSequentialThinker(): void {
  defaultInstance = null;
}
