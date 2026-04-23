#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const requiredAssets = {
  agents: [
    'boomerang.md', 'boomerang-coder.md', 'boomerang-architect.md',
    'boomerang-tester.md', 'boomerang-linter.md', 'boomerang-git.md',
    'boomerang-explorer.md', 'boomerang-writer.md', 'boomerang-scraper.md',
    'boomerang-init.md', 'boomerang-handoff.md', 'researcher.md'
  ],
  skills: [
    'boomerang-coder', 'boomerang-architect', 'boomerang-orchestrator',
    'boomerang-tester', 'boomerang-linter', 'boomerang-git',
    'boomerang-explorer', 'boomerang-writer', 'boomerang-scraper',
    'boomerang-init', 'boomerang-handoff'
  ],
  superMemory: [
    'pyproject.toml',
    'src/super_memory/__init__.py',
    'src/super_memory/memory.py'
  ]
};

let exitCode = 0;

// Check agents
for (const agent of requiredAssets.agents) {
  const p = path.join(root, 'agents', agent);
  if (!fs.existsSync(p)) {
    console.error(`❌ Missing agent: ${agent}`);
    exitCode = 1;
  }
}

// Check skills
for (const skill of requiredAssets.skills) {
  const p = path.join(root, 'skills', skill, 'SKILL.md');
  if (!fs.existsSync(p)) {
    console.error(`❌ Missing skill: ${skill}/SKILL.md`);
    exitCode = 1;
  }
}

// Check super-memory
for (const file of requiredAssets.superMemory) {
  const p = path.join(root, 'super-memory', file);
  if (!fs.existsSync(p)) {
    console.error(`❌ Missing super-memory file: ${file}`);
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log('✅ All assets verified');
}

process.exit(exitCode);