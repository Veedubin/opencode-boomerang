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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLD_PACKAGE_NAME = 'super-memory-mcp';
const NEW_PACKAGE_NAME = '@veedubin/opencode-boomerang';

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

function migrateMemoryData() {
  const oldPath = getMemoryDataPath();
  const newPath = path.join(process.env.HOME || '.', '.opencode-boomerang', 'memory');
  
  if (!fs.existsSync(oldPath)) {
    log('No legacy memory data found to migrate', 'info');
    return { migrated: false };
  }
  
  log(`Found legacy memory data at: ${oldPath}`, 'info');
  
  // Create new directory if needed
  const newDir = path.dirname(newPath);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }
  
  try {
    // Copy memory data
    const memories = fs.readdirSync(oldPath).filter(f => f.endsWith('.json'));
    let count = 0;
    
    for (const file of memories) {
      const src = path.join(oldPath, file);
      const dst = path.join(newPath, file);
      fs.copyFileSync(src, dst);
      count++;
    }
    
    log(`Migrated ${count} memory files`, 'success');
    return { migrated: true, count, oldPath, newPath };
  } catch (err) {
    log(`Failed to migrate memory data: ${err.message}`, 'error');
    return { migrated: false, error: err.message };
  }
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
  
  // Step 2: Migrate memory data
  log('Step 2: Migrating memory data...');
  const migrationResult = migrateMemoryData();
  
  console.log('');
  
  // Step 3: Update config
  log('Step 3: Updating OpenCode configuration...');
  const configResult = updateOpenCodeConfig();
  
  console.log('');
  
  // Step 4: Report artifacts
  log('Step 4: Checking for old artifacts...');
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