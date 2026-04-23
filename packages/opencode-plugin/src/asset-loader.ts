import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getAssetPath(type: 'agents' | 'skills'): string {
  return path.join(__dirname, '..', type);
}

export function loadAgentDefinition(agentName: string): string {
  const agentPath = path.join(getAssetPath('agents'), `${agentName}.md`);
  if (!fs.existsSync(agentPath)) throw new Error(`Agent not found: ${agentName}`);
  return fs.readFileSync(agentPath, 'utf-8');
}

export function loadSkillDefinition(skillName: string): string {
  const skillPath = path.join(getAssetPath('skills'), skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) throw new Error(`Skill not found: ${skillName}`);
  return fs.readFileSync(skillPath, 'utf-8');
}

export function listAvailableAgents(): string[] {
  return fs.readdirSync(getAssetPath('agents'))
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

export function listAvailableSkills(): string[] {
  const skillsDir = getAssetPath('skills');
  return fs.readdirSync(skillsDir)
    .filter(d => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')));
}