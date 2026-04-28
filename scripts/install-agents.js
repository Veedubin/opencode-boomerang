#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
const primaryArg = args.find(a => a.startsWith('--primary='))?.split('=')[1];
const secondaryArg = args.find(a => a.startsWith('--secondary='))?.split('=')[1];

// Model aliases
const ALIASES = {
  'k2k6': 'kimi-for-coding/k2p6',
  'k2k5': 'kimi-for-coding/k2p5',
  'k2k7': 'kimi-for-coding/k2p7',
  'm2k7': 'minimax/MiniMax-M2.7',
  'm2k5': 'minimax/MiniMax-M2.5',
  'claude-sonnet': 'anthropic/claude-sonnet-4-20250514',
  'claude-opus': 'anthropic/claude-opus-4-20250514',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gemini-flash': 'google/gemini-2.5-flash',
  'deepseek': 'deepseek/deepseek-chat-v3',
  'llama3': 'meta/llama-3.3-70b',
  'qwen': 'alibaba/qwen-2.5-72b',
};

function resolveModel(modelArg) {
  if (!modelArg) return null;
  return ALIASES[modelArg.toLowerCase()] || modelArg;
}

const primaryModel = resolveModel(primaryArg);
const secondaryModel = resolveModel(secondaryArg);

// Default models
const DEFAULT_PRIMARY = 'kimi-for-coding/k2p6';
const DEFAULT_SECONDARY = 'minimax/MiniMax-M2.7';

// Determine final models
const finalPrimary = primaryModel || DEFAULT_PRIMARY;
const finalSecondary = secondaryModel || (primaryModel ? primaryModel : DEFAULT_SECONDARY);

console.log('🚀 Boomerang Agent Installer');
console.log(`   Primary model:   ${finalPrimary}`);
console.log(`   Secondary model: ${finalSecondary}`);

// Read agent files from local agents/ directory
const agentsDir = join(__dirname, '..', 'agents');
const targetDir = join(process.cwd(), '.opencode', 'agents');

if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Determine tier by checking the default model in each file
function getAgentTier(content) {
  const modelMatch = content.match(/^model:\s*(.+)$/m);
  if (!modelMatch) return 'secondary';
  const defaultModel = modelMatch[1].trim();
  // Primary tier agents use kimi-for-coding/k2p6 by default
  return defaultModel.includes('kimi') ? 'primary' : 'secondary';
}

const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

for (const file of agentFiles) {
  const sourcePath = join(agentsDir, file);
  let content = readFileSync(sourcePath, 'utf-8');

  const tier = getAgentTier(content);
  const newModel = tier === 'primary' ? finalPrimary : finalSecondary;

  // Replace model in frontmatter
  content = content.replace(/^model:\s*.+$/m, `model: ${newModel}`);

  // Also replace model name in description text
  // Replace "Kimi K2.6" with primary model display name
  // Replace "MiniMax M2.7" with secondary model display name
  const primaryDisplay = finalPrimary.split('/').pop();
  const secondaryDisplay = finalSecondary.split('/').pop();

  content = content.replace(/Kimi K2\.6/g, primaryDisplay);
  content = content.replace(/MiniMax M2\.7/g, secondaryDisplay);

  const targetPath = join(targetDir, file);
  writeFileSync(targetPath, content);
  console.log(`   ✓ ${file} → ${newModel}`);
}

// Create/update opencode.json
const opencodePath = join(process.cwd(), '.opencode', 'opencode.json');
let opencode = {};
if (existsSync(opencodePath)) {
  opencode = JSON.parse(readFileSync(opencodePath, 'utf-8'));
}

if (!opencode.agents) opencode.agents = [];
// Add agent references if not present
const agentNames = agentFiles.map(f => f.replace('.md', ''));
for (const name of agentNames) {
  if (!opencode.agents.includes(name)) {
    opencode.agents.push(name);
  }
}

writeFileSync(opencodePath, JSON.stringify(opencode, null, 2));
console.log(`\n✅ Installed ${agentFiles.length} agents to ${targetDir}`);