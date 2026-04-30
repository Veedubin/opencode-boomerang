#!/usr/bin/env tsx
/**
 * Qdrant Container Manager
 *
 * Ensures a Qdrant container is running with consistent configuration.
 * Use this before starting Super-Memory-TS or running migrations.
 *
 * Features:
 * - Docker Compose mode (default if docker-compose.yml exists)
 * - Docker run mode (fallback if no compose file)
 * - Checks if container already exists (by name or image)
 * - If stopped, starts it (doesn't create new)
 * - If running, reuses it
 * - Consistent volume mount for persistence
 * - Configurable container name
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Configuration ---
const CONTAINER_NAME = process.env.QDRANT_CONTAINER_NAME || 'qdrant-boomerang';
const QDRANT_PORT = process.env.QDRANT_PORT || '6333';
const QDRANT_IMAGE = 'qdrant/qdrant';
const VOLUME_NAME = 'qdrant-boomerang-data';

// --- Helpers ---

interface ContainerInfo {
  name: string;
  status: 'running' | 'stopped' | 'not_found';
  id?: string;
}

function exec(command: string, options?: { encoding?: BufferEncoding }): string {
  try {
    return execSync(command, {
      encoding: options?.encoding || 'utf-8',
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    if (err instanceof Error && 'stderr' in err) {
      throw err;
    }
    throw err;
  }
}

function getContainerInfo(): ContainerInfo {
  try {
    // Check by container name first
    const nameOutput = exec(`docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Names}}|{{.Status}}"`, 'utf-8').trim();

    if (nameOutput) {
      const [name, status] = nameOutput.split('|');
      return {
        name,
        status: status?.startsWith('Up') ? 'running' : 'stopped',
        id: name,
      };
    }

    // Also check for any container running on our port
    const portOutput = exec(`docker ps -a --filter "publish=${QDRANT_PORT}" --format "{{.Names}}|{{.Status}}"`, 'utf-8').trim();

    if (portOutput) {
      const [name, status] = portOutput.split('|');
      return {
        name,
        status: status?.startsWith('Up') ? 'running' : 'stopped',
        id: name,
      };
    }

    return { name: CONTAINER_NAME, status: 'not_found' };
  } catch {
    return { name: CONTAINER_NAME, status: 'not_found' };
  }
}

function startExistingContainer(containerInfo: ContainerInfo): boolean {
  try {
    console.log(`  Starting existing container: ${containerInfo.name}`);
    exec(`docker start ${containerInfo.name}`);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to start container: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function createNewContainer(): boolean {
  try {
    console.log(`  Creating new container: ${CONTAINER_NAME}`);

    // Check if volume exists, create if not
    try {
      exec(`docker volume inspect ${VOLUME_NAME}`);
      console.log(`  Volume ${VOLUME_NAME} exists`);
    } catch {
      console.log(`  Creating volume: ${VOLUME_NAME}`);
      exec(`docker volume create ${VOLUME_NAME}`);
    }

    // Run new container
    exec(
      `docker run -d ` +
      `--name ${CONTAINER_NAME} ` +
      `-p ${QDRANT_PORT}:6333 ` +
      `-v ${VOLUME_NAME}:/qdrant/storage ` +
      `--restart unless-stopped ` +
      `${QDRANT_IMAGE}`
    );

    console.log(`  ✅ Container ${CONTAINER_NAME} created and started`);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to create container: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function waitForQdrantReady(timeoutMs: number = 30000): boolean {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = exec(`curl -s http://localhost:${QDRANT_PORT}/readyz`, 'utf-8').trim();
      if (response === 'true') {
        return true;
      }
    } catch {
      // Not ready yet
    }

    // Wait 500ms before next check
    const waitUntil = Date.now() + 500;
    while (Date.now() < waitUntil) {
      // busy wait
    }
  }

  return false;
}

function ensureVolumeOwnership(): void {
  // Ensure the volume is accessible by current user
  try {
    const volumePath = exec(`docker volume inspect ${VOLUME_NAME} --format "{{.Mountpoint}}"`, 'utf-8').trim();
    if (volumePath) {
      exec(`chmod -R 777 "${volumePath}" 2>/dev/null || true`);
    }
  } catch {
    // Volume might not exist yet or no permissions
  }
}

// --- Docker Compose Mode ---

function isComposeAvailable(): boolean {
  try {
    exec('docker-compose --version', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function hasComposeFile(): boolean {
  const composePath = path.join(process.cwd(), 'docker-compose.yml');
  return fs.existsSync(composePath);
}

function isComposeMode(force?: boolean): boolean {
  if (force !== undefined) return force;
  return hasComposeFile() && isComposeAvailable();
}

function waitForComposeHealth(timeoutMs: number = 60000): boolean {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // docker-compose ps with format gives us health status
      const output = exec('docker-compose ps qdrant --format json 2>/dev/null || docker-compose ps qdrant 2>/dev/null', 'utf-8');
      if (output.includes('healthy') || output.includes('Up')) {
        // Try hitting the health endpoint directly
        try {
          const response = exec(`curl -s http://localhost:${QDRANT_PORT}/healthz`, 'utf-8').trim();
          if (response === 'ok' || response === 'true') {
            return true;
          }
        } catch {
          // Try readyz endpoint
          try {
            const readyResponse = exec(`curl -s http://localhost:${QDRANT_PORT}/readyz`, 'utf-8').trim();
            if (readyResponse === 'true') {
              return true;
            }
          } catch {
            // Not ready yet
          }
        }
      }
    } catch {
      // Container might not be up yet
    }

    // Wait 2s before next check
    const waitUntil = Date.now() + 2000;
    while (Date.now() < waitUntil) {
      // busy wait
    }
  }

  return false;
}

function ensureQdrantCompose(): { success: boolean; error?: string } {
  console.log('  Using Docker Compose mode');

  try {
    // Check if already running via compose
    try {
      const psOutput = exec('docker-compose ps qdrant --format json 2>/dev/null || echo "[]"', 'utf-8').trim();
      if (psOutput && psOutput !== '[]' && psOutput.includes('"State":"running"')) {
        console.log('  ✅ Qdrant is already running via docker-compose');
        return { success: true };
      }
    } catch {
      // Continue to try starting
    }

    // Start or restart the service
    console.log('  Starting Qdrant via docker-compose...');

    // First try to start (won't recreate if already exists)
    try {
      exec('docker-compose up -d qdrant', 'utf-8');
      console.log('  ✅ Qdrant service started/updated');
    } catch (err) {
      // If start fails, try pulling and recreating
      console.log('  Start failed, attempting recreate...');
      exec('docker-compose up -d --force-recreate qdrant', 'utf-8');
      console.log('  ✅ Qdrant service recreated');
    }

    // Wait for health check
    console.log('  Waiting for Qdrant to be healthy...');
    if (waitForComposeHealth()) {
      console.log('  ✅ Qdrant is healthy and ready');
      return { success: true };
    } else {
      return { success: false, error: 'Qdrant did not become healthy in time' };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Main Logic ---

interface EnsureQdrantResult {
  success: boolean;
  wasAlreadyRunning: boolean;
  containerName: string;
  port: string;
  mode: 'compose' | 'docker-run';
  error?: string;
}

export function ensureQdrantContainer(options?: { compose?: boolean }): EnsureQdrantResult {
  console.log('\n🐳 Qdrant Container Manager');
  console.log('==========================\n');

  // Determine mode
  const composeMode = isComposeMode(options?.compose);
  console.log(`  Mode: ${composeMode ? 'Docker Compose' : 'Docker Run'}`);
  console.log(`  Container name: ${CONTAINER_NAME}`);
  console.log(`  Port: ${QDRANT_PORT}`);

  if (composeMode) {
    console.log(`  Compose file: ${path.join(process.cwd(), 'docker-compose.yml')}`);

    // Use compose mode
    const result = ensureQdrantCompose();
    if (result.success) {
      return {
        success: true,
        wasAlreadyRunning: false,
        containerName: 'qdrant-boomerang',
        port: QDRANT_PORT,
        mode: 'compose',
      };
    } else {
      return {
        success: false,
        wasAlreadyRunning: false,
        containerName: 'qdrant-boomerang',
        port: QDRANT_PORT,
        mode: 'compose',
        error: result.error,
      };
    }
  }

  // Docker run mode
  console.log(`  Volume: ${VOLUME_NAME}`);

  // Get current container state
  const containerInfo = getContainerInfo();
  console.log(`\n  Current status: ${containerInfo.status === 'not_found' ? 'not found' : containerInfo.status}`);

  if (containerInfo.status === 'running') {
    console.log(`\n  ✅ Qdrant is already running in container "${containerInfo.name}"`);
    return {
      success: true,
      wasAlreadyRunning: true,
      containerName: containerInfo.name,
      port: QDRANT_PORT,
      mode: 'docker-run',
    };
  }

  if (containerInfo.status === 'stopped') {
    console.log(`\n  ⏸️  Qdrant container exists but is stopped`);
    if (startExistingContainer(containerInfo)) {
      console.log(`  ✅ Container started`);

      // Wait for Qdrant to be ready
      console.log(`  Waiting for Qdrant to be ready...`);
      if (waitForQdrantReady()) {
        console.log(`  ✅ Qdrant is ready`);
        return {
          success: true,
          wasAlreadyRunning: false,
          containerName: containerInfo.name,
          port: QDRANT_PORT,
          mode: 'docker-run',
        };
      } else {
        return {
          success: false,
          wasAlreadyRunning: false,
          containerName: containerInfo.name,
          port: QDRANT_PORT,
          mode: 'docker-run',
          error: 'Container started but Qdrant did not become ready in time',
        };
      }
    } else {
      return {
        success: false,
        wasAlreadyRunning: false,
        containerName: containerInfo.name,
        port: QDRANT_PORT,
        mode: 'docker-run',
        error: 'Failed to start existing container',
      };
    }
  }

  // Not found - create new
  console.log(`\n  📦 No Qdrant container found`);
  if (createNewContainer()) {
    // Ensure we can access the volume
    ensureVolumeOwnership();

    // Wait for Qdrant to be ready
    console.log(`  Waiting for Qdrant to be ready...`);
    if (waitForQdrantReady()) {
      console.log(`  ✅ Qdrant is ready`);
      return {
        success: true,
        wasAlreadyRunning: false,
        containerName: CONTAINER_NAME,
        port: QDRANT_PORT,
        mode: 'docker-run',
      };
    } else {
      return {
        success: false,
        wasAlreadyRunning: false,
        containerName: CONTAINER_NAME,
        port: QDRANT_PORT,
        mode: 'docker-run',
        error: 'Container created but Qdrant did not become ready in time',
      };
    }
  } else {
    return {
      success: false,
      wasAlreadyRunning: false,
      containerName: CONTAINER_NAME,
      port: QDRANT_PORT,
      mode: 'docker-run',
      error: 'Failed to create new container',
    };
  }
}

// --- CLI Entry Point ---

async function main(): Promise<void> {
  // Parse --compose flag
  const args = process.argv.slice(2);
  const composeMode = args.includes('--compose') || args.includes('-c');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
🐳 Qdrant Container Manager

Usage:
  npx tsx scripts/qdrant-manager.ts [options]

Options:
  --compose, -c    Use docker-compose mode (default if docker-compose.yml exists)
  --docker, -d     Force docker run mode
  --help, -h       Show this help message

Examples:
  npx tsx scripts/qdrant-manager.ts           # Auto-detect mode
  npx tsx scripts/qdrant-manager.ts --compose # Force compose mode
  npx tsx scripts/qdrant-manager.ts --docker  # Force docker run mode
`);
    process.exit(0);
  }

  // Auto-detect mode if not specified
  const forceCompose = composeMode ? true : undefined;

  const result = ensureQdrantContainer({ compose: forceCompose });

  if (!result.success) {
    console.error(`\n❌ Failed to ensure Qdrant container: ${result.error}`);
    process.exit(1);
  }

  if (result.wasAlreadyRunning) {
    console.log(`\nℹ️  Qdrant was already running - reusing existing container`);
  } else {
    console.log(`\n✨ Qdrant is now running (${result.mode} mode)`);
  }

  console.log(`\n📍 Qdrant available at: http://localhost:${result.port}`);

  if (result.mode === 'compose') {
    console.log(`\nTo stop: docker-compose stop qdrant`);
    console.log(`To start: docker-compose start qdrant`);
    console.log(`To remove: docker-compose down`);
  } else {
    console.log(`\nTo stop: docker stop ${result.containerName}`);
    console.log(`To start: docker start ${result.containerName}`);
  }
}

main();