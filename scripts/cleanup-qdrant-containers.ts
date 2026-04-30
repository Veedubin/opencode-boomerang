#!/usr/bin/env tsx
/**
 * Qdrant Container Cleanup Script
 * 
 * Removes stale/exited Qdrant containers to clean up after issues.
 * Keeps the running one if any exists.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Container {
  id: string;
  name: string;
  status: string;
  ports: string;
}

function exec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    if (err instanceof Error && 'status' in err && (err as unknown as { status: number }).status !== 0) {
      return '';
    }
    throw err;
  }
}

function getQdrantContainers(): Container[] {
  const output = exec('docker ps -a --filter "ancestor=qdrant/qdrant" --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}"');
  
  if (!output.trim()) return [];
  
  return output.trim().split('\n').map(line => {
    const [id, name, status, ports] = line.split('|');
    return { id, name, status, ports };
  });
}

function main(): void {
  console.log('\n🧹 Qdrant Container Cleanup');
  console.log('===========================\n');
  
  const containers = getQdrantContainers();
  
  if (containers.length === 0) {
    console.log('  No Qdrant containers found');
    return;
  }
  
  console.log(`  Found ${containers.length} Qdrant container(s):\n`);
  
  const running: Container[] = [];
  const stopped: Container[] = [];
  
  for (const c of containers) {
    if (c.status.startsWith('Up')) {
      running.push(c);
    } else {
      stopped.push(c);
    }
    console.log(`    - ${c.name}: ${c.status}`);
  }
  
  console.log(`\n  Running: ${running.length}`);
  console.log(`  Stopped: ${stopped.length}`);
  
  if (stopped.length === 0) {
    console.log('\n  ✅ No cleanup needed - all containers are running');
    return;
  }
  
  if (running.length > 0) {
    console.log(`\n  ⚠️  Keeping ${running.length} running container(s):`);
    for (const c of running) {
      console.log(`    - ${c.name} (${c.id})`);
    }
  }
  
  console.log(`\n  🗑️  Removing ${stopped.length} stopped container(s)...`);
  
  let removed = 0;
  let failed = 0;
  
  for (const c of stopped) {
    try {
      exec(`docker rm ${c.name}`);
      console.log(`    ✅ Removed: ${c.name}`);
      removed++;
    } catch (err) {
      console.error(`    ❌ Failed to remove: ${c.name}`);
      failed++;
    }
  }
  
  console.log(`\n  Summary: removed ${removed}/${stopped.length}, failed ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main();
