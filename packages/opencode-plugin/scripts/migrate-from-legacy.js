#!/usr/bin/env node

/**
 * Migration script from legacy super-memory-mcp to @veedubin/opencode-boomerang
 * 
 * This script:
 * 1. Detects old super-memory-mcp installation
 * 2. Migrates memory data to new format
 * 3. Updates OpenCode configuration
 * 4. Removes old artifacts
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common search paths for legacy super-memory data
const COMMON_MEMORY_PATHS = [
  './memory_data',
  './.super-memory/memory',
  '../memory_data',
  '../../memory_data',
  path.join(os.homedir(), 'memory_data'),
  path.join(os.homedir(), '.super-memory/memory'),
  path.join(os.homedir(), 'Projects/MCP-Servers/Super-Memory/memory_data'),
  path.join(os.homedir(), 'Projects/MCP-Servers/memory_data'),
];

const OLD_PACKAGE_NAME = 'super-memory-mcp';
const NEW_PACKAGE_NAME = '@veedubin/opencode-boomerang';
const DEFAULT_MIGRATION_TARGET = path.join(os.homedir(), '.local', 'share', 'opencode-boomerang', 'memory');

// Helper: check if file/directory exists
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Find LanceDB files in a directory
async function findLanceDBFiles(dir) {
  try {
    const files = await fs.promises.readdir(dir);
    return files.filter(f => f.endsWith('.lance') || f === 'memories.lance');
  } catch {
    return [];
  }
}

// Search common locations for legacy memory data
async function findLegacyMemoryData() {
  const found = [];
  
  for (const memPath of COMMON_MEMORY_PATHS) {
    if (await fileExists(memPath)) {
      // Check if it contains LanceDB data or JSON memory files
      const lanceFiles = await findLanceDBFiles(memPath);
      let hasData = lanceFiles.length > 0;
      
      // Also check for JSON memory files (legacy format)
      if (!hasData) {
        try {
          const files = await fs.promises.readdir(memPath);
          hasData = files.some(f => f.endsWith('.json'));
        } catch {
          // ignore
        }
      }
      
      if (hasData) {
        found.push({
          path: memPath,
          type: lanceFiles.length > 0 ? 'lancedb' : 'json',
          lanceFiles
        });
      }
    }
  }
  
  return found;
}

function log(message, type = 'info') {
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }[type];
  console.log(`${prefix} ${message}`);
}

function detectOldInstallation() {
  const cwd = process.cwd();
  
  // Check package.json for old package
  const packageJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps[OLD_PACKAGE_NAME]) {
        return { found: true, version: deps[OLD_PACKAGE_NAME] };
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  
  // Check node_modules directly
  const oldModulePath = path.join(cwd, 'node_modules', OLD_PACKAGE_NAME);
  if (fs.existsSync(oldModulePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(oldModulePath, 'package.json'), 'utf-8'));
      return { found: true, version: pkg.version };
    } catch (e) {
      return { found: true, version: 'unknown' };
    }
  }
  
  return { found: false };
}

function getMemoryDataPath() {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.super-memory', 'data');
}

async function copyDir(src, dst) {
  try {
    await fs.promises.mkdir(dst, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, dstPath);
      } else {
        await fs.promises.copyFile(srcPath, dstPath);
      }
    }
    return true;
  } catch (err) {
    throw err;
  }
}

// Migrate a single location's memory data
async function migrateFromLocation(loc, newPath) {
  try {
    const files = await fs.promises.readdir(loc.path);
    let count = 0;
    
    for (const file of files) {
      const src = path.join(loc.path, file);
      const dst = path.join(newPath, `${path.basename(loc.path)}_${file}`);
      
      const stat = await fs.promises.stat(src);
      if (stat.isDirectory()) {
        // LanceDB data is stored as directory
        await copyDir(src, dst);
        count++;
      } else if (file.endsWith('.json')) {
        // JSON memory files
        await fs.promises.copyFile(src, dst);
        count++;
      }
    }
    
    return { path: loc.path, count, success: true };
  } catch (err) {
    return { path: loc.path, count: 0, success: false, error: err.message };
  }
}

async function migrateMemoryData(foundLocations) {
  if (foundLocations.length === 0) {
    log('No legacy memory data found to migrate', 'info');
    return { migrated: false };
  }

  // Show found locations
  log(`Found ${foundLocations.length} legacy memory location(s):`, 'info');
  foundLocations.forEach((loc, i) => {
    log(`  ${i + 1}. ${loc.path} (${loc.type})`, 'info');
  });

  // For non-interactive usage, migrate all
  const migrateIndices = foundLocations.map((_, i) => i);

  const newPath = DEFAULT_MIGRATION_TARGET;
  
  // Create new directory if needed
  if (!fs.existsSync(newPath)) {
    fs.mkdirSync(newPath, { recursive: true });
  }

  let totalMigrated = 0;
  const results = [];

  for (const idx of migrateIndices) {
    const loc = foundLocations[idx];
    log(`\nMigrating from: ${loc.path}`, 'info');
    
    const result = await migrateFromLocation(loc, newPath);
    if (result.success) {
      log(`Migrated ${result.count} files from ${loc.path}`, 'success');
    } else {
      log(`Failed to migrate ${loc.path}: ${result.error}`, 'error');
    }
    totalMigrated += result.count;
    results.push(result);
  }

  return {
    migrated: totalMigrated > 0,
    count: totalMigrated,
    results,
    newPath
  };
}

function updateOpenCodeConfig() {
  const home = process.env.HOME || '.';
  const configPaths = [
    path.join(home, '.config', 'opencode', 'opencode.json'),
    path.join(home, '.opencode', 'opencode.json'),
    path.join(home, '.opencode.json'),
  ];
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Update package reference
        if (config.packages?.[OLD_PACKAGE_NAME]) {
          config.packages[NEW_PACKAGE_NAME] = config.packages[OLD_PACKAGE_NAME];
          delete config.packages[OLD_PACKAGE_NAME];
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          log(`Updated OpenCode config at: ${configPath}`, 'success');
          return { updated: true, path: configPath };
        }
      } catch (e) {
        // Try next path
      }
    }
  }
  
  log('No OpenCode config found needing update', 'info');
  return { updated: false };
}

function removeOldArtifacts() {
  const cwd = process.cwd();
  const artifacts = [];
  
  // Check for old artifact directories
  const artifactPaths = [
    path.join(cwd, 'node_modules', OLD_PACKAGE_NAME),
    path.join(cwd, '.super-memory'),
  ];
  
  for (const artifactPath of artifactPaths) {
    if (fs.existsSync(artifactPath)) {
      artifacts.push(artifactPath);
    }
  }
  
  if (artifacts.length === 0) {
    log('No old artifacts found to remove', 'info');
    return { removed: [] };
  }
  
  log('Found old artifacts (not removing automatically - review manually):', 'warning');
  for (const artifact of artifacts) {
    log(`  - ${artifact}`, 'warning');
  }
  
  return { removed: [], skipped: artifacts };
}

async function main() {
  console.log('\n🔄 Boomerang Migration Script');
  console.log('==============================\n');
  
  log(`Migrating from ${OLD_PACKAGE_NAME} to ${NEW_PACKAGE_NAME}\n`);
  
  // Step 1: Detect old installation
  log('Step 1: Detecting old installation...');
  const oldInstall = detectOldInstallation();
  
  if (!oldInstall.found) {
    log('No legacy super-memory-mcp installation detected.', 'info');
    log('If you have data to migrate, ensure super-memory-mcp was installed in a project directory.');
  } else {
    log(`Found legacy installation: ${OLD_PACKAGE_NAME}@${oldInstall.version}`, 'success');
  }
  
  console.log('');
  
  // Step 2: Search for and migrate memory data
  log('Step 2: Searching for legacy memory data...');
  const foundLocations = await findLegacyMemoryData();
  
  log('Step 3: Migrating memory data...');
  const migrationResult = await migrateMemoryData(foundLocations);
  
  console.log('');

  // Step 4: Update config
  log('Step 4: Updating OpenCode configuration...');
  const configResult = updateOpenCodeConfig();

  console.log('');

  // Step 5: Report artifacts
  log('Step 5: Checking for old artifacts...');
  const cleanupResult = removeOldArtifacts();
  
  console.log('\n==============================');
  log('Migration Summary', 'info');
  console.log('==============================');
  log(`Legacy installation: ${oldInstall.found ? 'found' : 'not found'}`);
  log(`Memory data migrated: ${migrationResult.migrated ? `yes (${migrationResult.count} files)` : 'no'}`);
  log(`Config updated: ${configResult.updated ? 'yes' : 'no'}`);
  
  if (cleanupResult.skipped?.length > 0) {
    log(`Old artifacts found: ${cleanupResult.skipped.length} (review manually)`, 'warning');
  }
  
  console.log('\n✅ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Install new package: npm install -g @veedubin/opencode-boomerang');
  console.log('2. Restart OpenCode');
  console.log('3. If you had old artifacts, manually remove them: rm -rf node_modules/super-memory-mcp .super-memory');
  console.log('');
}

main().catch(err => {
  log(`Migration failed: ${err.message}`, 'error');
  process.exit(1);
});