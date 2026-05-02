import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import type { AgentDefinition } from './protocol/types.js';
import { parseFrontmatter as parseFm, extractContent, parseSkillsArray } from './utils/frontmatter.js';

/**
 * Skill definition parsed from SKILL.md files
 */
export interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
}

// Re-export AgentDefinition from protocol/types
export { type AgentDefinition } from './protocol/types.js';

// Cache for loaded assets
let agentsCache: AgentDefinition[] | null = null;
let skillsCache: SkillDefinition[] | null = null;

/**
 * Parse YAML frontmatter from markdown content
 * @deprecated Use parseFrontmatter from utils/frontmatter.ts
 */
function parseFrontmatter(content: string): Record<string, string> {
  return parseFm(content);
}

/**
 * Extract system prompt from markdown content (content after frontmatter)
 * @deprecated Use extractContent from utils/frontmatter.ts
 */
function extractSystemPrompt(content: string): string {
  return extractContent(content);
}

/**
 * Load all agents from the agents/ directory
 */
export function loadAgents(): AgentDefinition[] {
  if (agentsCache) {
    return agentsCache;
  }

  const agents: AgentDefinition[] = [];
  const agentsDir = join(__dirname, '..', 'agents');

  try {
    const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = join(agentsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const systemPrompt = extractSystemPrompt(content);

      // Get name from filename (e.g., boomerang-coder.md -> boomerang-coder)
      const name = file.replace(/\.md$/, '');

      // Parse skills array if present
      const skills = frontmatter.skills ? parseSkillsArray(frontmatter.skills) : [];

      agents.push({
        name,
        description: frontmatter.description || '',
        systemPrompt,
        skills
      });
    }
  } catch (error) {
    console.error('Error loading agents:', error);
  }

  agentsCache = agents;
  return agents;
}

/**
 * Load all skills from the skills/ subdirectories
 */
export function loadSkills(): SkillDefinition[] {
  if (skillsCache) {
    return skillsCache;
  }

  const skills: SkillDefinition[] = [];
  const skillsDir = join(__dirname, '..', 'skills');

  try {
    const skillDirs = readdirSync(skillsDir).filter(f => {
      try {
        return readdirSync(join(skillsDir, f)).some(file => file === 'SKILL.md');
      } catch {
        return false;
      }
    });

    for (const dir of skillDirs) {
      const skillPath = join(skillsDir, dir, 'SKILL.md');
      const content = readFileSync(skillPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      // Extract instructions from content after frontmatter
      const instructions = extractSystemPrompt(content);

      // Use name from frontmatter or directory name
      const name = frontmatter.name || dir;

      skills.push({
        name,
        description: frontmatter.description || '',
        instructions
      });
    }
  } catch (error) {
    console.error('Error loading skills:', error);
  }

  skillsCache = skills;
  return skills;
}

/**
 * Get a specific agent by name
 */
export function getAgent(name: string): AgentDefinition | undefined {
  const agents = loadAgents();
  return agents.find(a => a.name === name);
}

/**
 * Get a specific skill by name
 */
export function getSkill(name: string): SkillDefinition | undefined {
  const skills = loadSkills();
  return skills.find(s => s.name === name);
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  agentsCache = null;
  skillsCache = null;
}
