#!/usr/bin/env node

/**
 * Boomerang CLI wrapper
 * Provides command-line interface for Boomerang plugin operations
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args[0] === 'migrate') {
  // Run migration script - scripts is sibling to bin
  const scriptPath = resolve(__dirname, '..', 'scripts', 'migrate-from-legacy.js');
  await import(scriptPath);
} else if (args[0] === 'install-agents') {
  const scriptPath = resolve(__dirname, '..', 'scripts', 'install-agents.js');
  await import(scriptPath);
} else {
  console.log('Boomerang CLI - Multi-agent orchestration plugin for OpenCode');
  console.log('');
  console.log('Usage: boomerang <command>');
  console.log('');
  console.log('Commands:');
  console.log('  migrate         Migrate from legacy super-memory-mcp to Boomerang');
  console.log('  install-agents  Install Boomerang agents to .opencode/agents/');
  console.log('');
  process.exit(1);
}