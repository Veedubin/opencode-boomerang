#!/usr/bin/env node
/**
 * Migration script from super-memory-mcp (legacy) to Boomerang v1.0.7 built-in memory
 *
 * This script:
 * 1. Detects old super-memory-mcp installation
 * 2. Migrates memory data to new format
 * 3. Updates configuration files
 * 4. Removes old dependencies
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function detectLegacySetup() {
  const checks = {
    // Check for old Python super-memory
    hasOldPythonMemory: await fileExists('./Super-Memory'),
    hasOldMCPConfig: await fileExists('./.opencode/mcp.json'),
    hasOldMemoryData: await fileExists('./memory_data'),
    hasOldPyProject: await fileExists('./pyproject.toml'),
    hasOldPlugin: await fileExists('./.opencode/plugins/boomerang'),
  };

  return checks;
}

async function migrateMemoryData() {
  console.log('🧠 Migrating memory data...');

  const oldMemoryPath = './memory_data';
  const newMemoryPath = './.boomerang/memory';

  if (await fileExists(oldMemoryPath)) {
    // Copy old memory data to new location
    await fs.mkdir(newMemoryPath, { recursive: true });

    // Copy LanceDB files
    const files = await fs.readdir(oldMemoryPath);
    for (const file of files) {
      const src = path.join(oldMemoryPath, file);
      const dest = path.join(newMemoryPath, file);
      await fs.cp(src, dest, { recursive: true });
    }

    console.log(`✅ Migrated memory data to ${newMemoryPath}`);
    return true;
  }

  console.log('ℹ️ No old memory data found');
  return false;
}

async function updateOpenCodeConfig() {
  console.log('🔧 Updating OpenCode configuration...');

  const configPath = './.opencode/opencode.json';

  if (await fileExists(configPath)) {
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

    // Remove old MCP server config
    if (config.mcpServers) {
      delete config.mcpServers['super-memory'];
      delete config.mcpServers['super-memory-mcp'];
      console.log('✅ Removed old MCP server configuration');
    }

    // Update plugin config
    if (!config.plugins) config.plugins = [];

    // Remove old plugin reference if exists
    config.plugins = config.plugins.filter(p =>
      p !== 'super-memory-mcp' && p !== '@veedubin/super-memory-mcp'
    );

    // Add new plugin if not present
    if (!config.plugins.includes('@veedubin/opencode-boomerang')) {
      config.plugins.push('@veedubin/opencode-boomerang');
      console.log('✅ Added Boomerang v1.0.7 plugin');
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return true;
  }

  return false;
}

async function cleanupOldArtifacts() {
  console.log('🧹 Cleaning up old artifacts...');

  const toRemove = [
    './Super-Memory',
    './super-memory-mcp',
    './memory_data', // after migration
    './src/opencode_boomerang', // old Python package
  ];

  for (const item of toRemove) {
    if (await fileExists(item)) {
      console.log(`  Removing ${item}...`);
      await fs.rm(item, { recursive: true, force: true });
    }
  }

  console.log('✅ Cleanup complete');
}

async function fileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🚀 Boomerang Migration Tool');
  console.log('==========================\n');

  // Detect legacy setup
  const legacy = await detectLegacySetup();
  console.log('Legacy setup detected:');
  Object.entries(legacy).forEach(([key, value]) => {
    console.log(`  ${key}: ${value ? '✅' : '❌'}`);
  });

  const hasLegacy = Object.values(legacy).some(v => v);

  if (!hasLegacy) {
    console.log('\n✨ No legacy setup detected. You\'re already up to date!');
    return;
  }

  console.log('\nStarting migration...\n');

  // Migrate data
  await migrateMemoryData();

  // Update config
  await updateOpenCodeConfig();

  // Cleanup
  await cleanupOldArtifacts();

  console.log('\n✅ Migration complete!');
  console.log('\nNext steps:');
  console.log('  1. Run: npm install -g @veedubin/opencode-boomerang');
  console.log('  2. Restart OpenCode');
  console.log('  3. Your old memories are preserved in ./.boomerang/memory');
}

main().catch(console.error);
