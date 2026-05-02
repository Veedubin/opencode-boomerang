/**
 * Agent Prompts - Load and manage agent prompt templates from directory files
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { AgentDefinition } from '../protocol/types.js';

export { type AgentDefinition } from '../protocol/types.js';

export interface AgentPrompt {
  name: string;
  model: string;
  prompt: string;
  systemPrompt: string;
  skillContent?: string;
}

const AGENT_FILE_PATTERN = '*.md';

export class AgentPromptLoader {
  private prompts: Map<string, AgentPrompt> = new Map();
  private agentDirs: string[];
  private skillDirs: string[];

  constructor(agentDirs: string[] = DEFAULT_AGENT_DIRS, skillDirs: string[] = DEFAULT_SKILL_DIRS) {
    this.agentDirs = agentDirs;
    this.skillDirs = skillDirs;
  }

  /**
   * Load skills for an agent from skill directories
   */
  async loadSkills(agentName: string): Promise<string | undefined> {
    for (const dir of this.skillDirs) {
      const skillPath = join(dir, agentName, 'SKILL.md');
      try {
        const content = await readFile(skillPath, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        return frontmatterMatch ? frontmatterMatch[2].trim() : content.trim();
      } catch {
        // Skill not found in this dir, continue
      }
    }
    return undefined;
  }

  /**
   * Load an agent by name
   */
  async loadAgent(name: string): Promise<AgentPrompt> {
    // Check cache first
    const cached = this.prompts.get(name);
    if (cached) return cached;

    // Search in all directories
    for (const dir of this.agentDirs) {
      try {
        await access(dir);
        const prompt = await this.loadFromDirectory(dir, name);
        if (prompt) {
          this.prompts.set(name, prompt);
          return prompt;
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    throw new Error(`Agent '${name}' not found in any configured directory`);
  }

  /**
   * List all available agent names
   */
  listAgents(): string[] {
    return Array.from(this.prompts.keys());
  }

  /**
   * Check if an agent exists
   */
  hasAgent(name: string): boolean {
    return this.prompts.has(name);
  }

  /**
   * Load all agents from directories
   */
  async loadAll(): Promise<void> {
    for (const dir of this.agentDirs) {
      await this.loadFromDirectory(dir);
    }
  }

  /**
   * Load agents from a specific directory
   */
  private async loadFromDirectory(dir: string, specificName?: string): Promise<AgentPrompt | null> {
    try {
      const files = await readdir(dir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const agentName = basename(file, '.md');
        
        // If specificName provided, only load that one
        if (specificName && agentName !== specificName) continue;

        // Skip if already loaded
        if (this.prompts.has(agentName)) continue;

        const filePath = join(dir, file);
        const content = await readFile(filePath, 'utf-8');
        const prompt = this.parseAgentFile(content, file);

        if (prompt) {
          // Load skills for this agent
          prompt.skillContent = await this.loadSkills(basename(file, '.md'));
          this.prompts.set(agentName, prompt);
          
          if (specificName === agentName) {
            return prompt;
          }
        }
      }
    } catch (error) {
      // Silently skip invalid directories
    }

    return null;
  }

  /**
   * Parse an agent markdown file
   * Extracts frontmatter (YAML) and content sections
   */
  private parseAgentFile(content: string, fileName: string): AgentPrompt | null {
    try {
      // Split frontmatter from content
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      
      if (!frontmatterMatch) {
        // No frontmatter - use filename as name, entire content as prompt
        return {
          name: basename(fileName, '.md'),
          model: 'unknown',
          prompt: content.trim(),
          systemPrompt: '',
        };
      }

      const [, frontmatterYaml, bodyContent] = frontmatterMatch;

      // Parse YAML frontmatter
      const frontmatter = this.parseYaml(frontmatterYaml);

      // Extract system prompt from body (before first heading or ##)
      const body = bodyContent.trim();
      const systemPromptEnd = body.indexOf('\n##');
      const systemPrompt = systemPromptEnd > 0 ? body.substring(0, systemPromptEnd).trim() : body.split('\n---\n')[0] || '';
      
      // Main prompt is everything after system prompt
      const prompt = systemPromptEnd > 0 ? body.substring(systemPromptEnd).trim() : body;

      return {
        name: basename(fileName, '.md'),
        model: (frontmatter.model as string) || 'unknown',
        prompt,
        systemPrompt,
      };
    } catch (error) {
      console.error(`Failed to parse agent file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value: unknown = line.substring(colonIndex + 1).trim();

      // Handle quoted strings
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value))) value = Number(value);
      else if (typeof value === 'string' && (value.startsWith('"') || value.startsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }
}

export const DEFAULT_AGENT_DIRS = [
  'agents/',
  '.opencode/agents/',
];

export const DEFAULT_SKILL_DIRS = [
  'skills/',
  '.opencode/skills/',
];