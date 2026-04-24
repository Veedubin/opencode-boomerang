import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Agent definition parsed from markdown files
 */
export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
}

/**
 * Skill definition parsed from SKILL.md files
 */
export interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
}

// Cache for loaded assets
let agentsCache: AgentDefinition[] | null = null;
let skillsCache: SkillDefinition[] | null = null;

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return frontmatter;
  }

  const lines = match[1].split('\n');
  let currentKey = '';
  let currentValue = '';
  let inMultiline = false;

  for (const line of lines) {
    if (inMultiline) {
      if (line.startsWith('    ') || line.startsWith('\t')) {
        // Continuation of multiline value
        currentValue += '\n' + line.replace(/^[ ]{4}|^\t/, '');
      } else {
        // End of multiline value
        frontmatter[currentKey] = currentValue.trim();
        inMultiline = false;
      }
    }

    const keyMatch = line.match(/^(\w+):\s*(.*)/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      currentValue = keyMatch[2];

      if (currentValue === '' || currentValue === '|') {
        inMultiline = true;
      } else {
        frontmatter[currentKey] = currentValue.trim();
      }
    }
  }

  return frontmatter;
}

/**
 * Extract system prompt from markdown content (content after frontmatter)
 */
function extractSystemPrompt(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  return match ? match[1].trim() : content;
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

      // Parse skills array if present (stored as YAML array)
      let skills: string[] = [];
      if (frontmatter.skills) {
        // Parse YAML array format: [\n  "- skill1"\n  "- skill2"\n]
        const skillsMatch = frontmatter.skills.match(/\[([\s\S]*?)\]/);
        if (skillsMatch) {
          const skillsContent = skillsMatch[1];
          skills = skillsContent
            .split('\n')
            .map(s => s.replace(/^\s*["']|["']\s*$/g, '').trim())
            .filter(s => s.length > 0);
        }
      }

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
