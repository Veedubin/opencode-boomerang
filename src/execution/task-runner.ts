/**
 * Task Runner - Prompt Builder (NO subprocess execution)
 * 
 * Protocol Enforcement v4.0: This is now a PROMPT BUILDER only.
 * Agent execution is handled by OpenCode's native agent system.
 * 
 * The old AgentSpawner-based execution has been deleted.
 * This module now ONLY handles prompt composition.
 */

export interface Task {
  id: string;
  agent: string;
  description: string;
  context?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high';
}

export interface ExecutionContext {
  sessionId: string;
  taskGraph?: Task[];
  parentTask?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output: string;
  agentUsed: string;
  durationMs: number;
  tokensUsed?: number;
  error?: string;
}

/**
 * TaskRunner - Now a prompt builder only
 * 
 * Does NOT execute agents. OpenCode executes agents natively.
 * This class only composes prompts from context.
 */
export class TaskRunner {
  /**
   * Build the full prompt from task and agent prompt template
   * (formerly buildPrompt, now the main public method)
   */
  buildPrompt(task: Task, agentPrompt: AgentPrompt): string {
    const parts: string[] = [];

    // Layer 1: Agent identity
    if (agentPrompt.systemPrompt) {
      parts.push(agentPrompt.systemPrompt);
    }

    // Layer 2: Agent rules, style guides, output format
    if (agentPrompt.prompt) {
      parts.push(agentPrompt.prompt);
    }

    // Layer 3: Skill instructions
    if (agentPrompt.skillContent) {
      parts.push(`## Skills\n${agentPrompt.skillContent}`);
    }

    // Layer 4: Context Package
    if (task.context && Object.keys(task.context).length > 0) {
      parts.push(this.formatContext(task.context));
    }

    // Layer 5: Task description
    parts.push(`## Task\n${task.description}`);

    // Layer 6: Execution instructions
    parts.push(`## Instructions\n1. Execute the task described above\n2. Return a summary of what was accomplished\n3. Include any files modified or created`);

    return parts.join('\n\n');
  }

  /**
   * Format context object into readable sections
   */
  private formatContext(context: Record<string, unknown>): string {
    const knownSections = [
      'originalUserRequest', 'taskBackground', 'relevantFiles',
      'codeSnippets', 'previousDecisions', 'expectedOutput',
      'scopeBoundaries', 'errorHandling'
    ];

    const sections: string[] = ['## Context'];
    const unknownEntries: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || value === null) continue;

      if (knownSections.includes(key)) {
        const title = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        sections.push(`### ${title}\n${this.formatValue(value)}`);
      } else {
        unknownEntries.push(`- ${key}: ${this.formatValue(value)}`);
      }
    }

    if (unknownEntries.length > 0) {
      sections.push(`### Additional Context\n${unknownEntries.join('\n')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Format a value for display in context
   */
  private formatValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.map(v => this.formatValue(v)).join('\n');
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `- ${k}: ${this.formatValue(v)}`)
        .join('\n');
    }
    return String(value);
  }
}

export interface AgentPrompt {
  name: string;
  model: string;
  prompt: string;
  systemPrompt: string;
  skillContent?: string;
}
