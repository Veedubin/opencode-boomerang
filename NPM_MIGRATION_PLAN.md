# Boomerang NPM Migration Plan

## Comprehensive Implementation Plan for Migrating to a Pure NPM Package with Bundled Super-Memory

**Version:** 1.0  
**Date:** 2026-04-23  
**Status:** Draft for Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Super-Memory Integration Strategy](#4-super-memory-integration-strategy)
5. [Package Structure](#5-package-structure)
6. [File Migration Matrix](#6-file-migration-matrix)
7. [Build & Publishing Process](#7-build--publishing-process)
8. [Configuration Changes](#8-configuration-changes)
9. [Implementation Steps](#9-implementation-steps)
10. [Code Examples](#10-code-examples)
11. [Risks & Mitigation](#11-risks--mitigation)

---

## 1. Executive Summary

This plan details the migration of the Boomerang multi-agent orchestration system from a hybrid Python/TypeScript project to a **pure NPM package** (`@boomerang/opencode-plugin`) with **natively bundled super-memory**.

### Key Objectives

| # | Objective | Priority |
|---|-----------|----------|
| 1 | Remove all Python/PyPI artifacts | Must |
| 2 | Bundle super-memory as mandatory, automatic subsystem | Must |
| 3 | Include agents and skills in NPM package | Must |
| 4 | Eliminate manual copy/install steps | Must |
| 5 | Make memory operations automatic (like git gates) | Must |
| 6 | Maintain backward compatibility where possible | Should |

### Recommended Super-Memory Approach

**Option B: Bundle Python Super-Memory as Subprocess** (Recommended)

Rationale:
- **No rewrite risk**: Preserves existing Python codebase (lancedb, sentence-transformers)
- **Full lifecycle control**: Plugin spawns/manages Python process
- **Automatic operation**: Works like git gates—transparent to users
- **Fastest path**: Minimal changes to proven super-memory code
- **Reliable**: Uses stdio JSON-RPC (same transport as current MCP server)

Rejected alternatives:
- **Option A (TypeScript port)**: High risk—lancedb npm package may lack feature parity; major rewrite effort
- **Option C (Internal HTTP)**: Doesn't solve external dependency; adds complexity

---

## 2. Current State Analysis

### 2.1 Directory Structure (Current)

```
/home/jcharles/Projects/MCP-Servers/boomerang/
├── .opencode/
│   ├── plugins/boomerang/          ← TypeScript plugin (current)
│   │   ├── src/
│   │   │   ├── index.ts            ← Plugin entry point
│   │   │   ├── memory.ts           ← HTTP calls to super-memory API
│   │   │   ├── orchestrator.ts     ← Task orchestration
│   │   │   ├── task-executor.ts    ← Agent execution
│   │   │   ├── types.ts            ← Type definitions
│   │   │   └── ... (11 more files)
│   │   ├── dist/                   ← Compiled JS output
│   │   ├── package.json            ← Current: @veedubin/opencode-boomerang
│   │   └── tsconfig.json
│   ├── agents/                     ← 12 markdown files (NOT in package)
│   │   ├── boomerang.md
│   │   ├── boomerang-coder.md
│   │   └── ... (10 more)
│   └── skills/                     ← 11 skill directories (NOT in package)
│       ├── boomerang-coder/SKILL.md
│       └── ... (10 more)
├── src/opencode_boomerang/         ← Python package (TO REMOVE)
│   ├── __init__.py
│   └── assets/
├── releases/opencode-boomerang/    ← Release artifacts (TO REMOVE)
├── pyproject.toml                  ← Python build config (TO REMOVE)
├── uv.lock                         ← Python lockfile (TO REMOVE)
└── memory_data/                    ← Local memory store (KEEP, but relocate)
```

### 2.2 Current Memory Architecture

```
┌─────────────────┐     HTTP JSON-RPC      ┌──────────────────┐
│  Boomerang      │ ─────────────────────→ │  Super-Memory    │
│  Plugin (TS)    │    (External API)      │  MCP Server (Py) │
│                 │                        │                  │
│  memory.ts      │                        │  lancedb         │
│  (MCP tools)    │                        │  torch           │
│                 │                        │  sentence-transformers
└─────────────────┘                        └──────────────────┘
```

**Problems with current approach:**
1. Super-memory is external dependency requiring separate installation
2. Memory tools exposed as MCP tools—user must choose to call them
3. HTTP API requires API key and network connectivity
4. Agents/skills require manual copy to `.opencode/` directory
5. Python package in `src/` is dead code

---

## 3. Target Architecture

### 3.1 Target Directory Structure

```
/home/jcharles/Projects/MCP-Servers/boomerang/          ← Git repo root
├── packages/
│   └── opencode-plugin/                                 ← NPM package root
│       ├── package.json                                 ← @boomerang/opencode-plugin
│       ├── tsconfig.json
│       ├── README.md
│       ├── LICENSE
│       ├── src/                                         ← TypeScript source
│       │   ├── index.ts                                 ← Plugin entry point
│       │   ├── memory.ts                                ← Native memory client
│       │   ├── memory-engine.ts                         ← Subprocess manager
│       │   ├── orchestrator.ts
│       │   ├── task-executor.ts
│       │   ├── task-parser.ts
│       │   ├── git.ts
│       │   ├── quality-gates.ts
│       │   ├── session-state.ts
│       │   ├── agent-state.ts
│       │   ├── task-state.ts
│       │   ├── context-isolation.ts
│       │   ├── lazy-compaction.ts
│       │   ├── middleware.ts
│       │   ├── types.ts
│       │   └── asset-loader.ts                        ← NEW: Load bundled agents/skills
│       ├── dist/                                        ← Compiled output (gitignored)
│       ├── agents/                                      ← Bundled agent definitions
│       │   ├── boomerang.md
│       │   ├── boomerang-coder.md
│       │   ├── boomerang-architect.md
│       │   ├── boomerang-tester.md
│       │   ├── boomerang-linter.md
│       │   ├── boomerang-git.md
│       │   ├── boomerang-explorer.md
│       │   ├── boomerang-writer.md
│       │   ├── boomerang-scraper.md
│       │   ├── boomerang-init.md
│       │   ├── boomerang-handoff.md
│       │   └── researcher.md
│       ├── skills/                                      ← Bundled skill definitions
│       │   ├── boomerang-coder/SKILL.md
│       │   ├── boomerang-architect/SKILL.md
│       │   ├── boomerang-orchestrator/SKILL.md
│       │   ├── boomerang-tester/SKILL.md
│       │   ├── boomerang-linter/SKILL.md
│       │   ├── boomerang-git/SKILL.md
│       │   ├── boomerang-explorer/SKILL.md
│       │   ├── boomerang-writer/SKILL.md
│       │   ├── boomerang-scraper/SKILL.md
│       │   ├── boomerang-init/SKILL.md
│       │   └── boomerang-handoff/SKILL.md
│       └── super-memory/                                ← Bundled Python super-memory
│           ├── pyproject.toml
│           ├── src/super_memory/
│           │   ├── __init__.py
│           │   ├── __main__.py
│           │   ├── memory.py
│           │   ├── mcp_tools.py
│           │   ├── schema.py
│           │   ├── config.py
│           │   └── exceptions.py
│           └── requirements.txt
├── docs/
├── examples/
└── CHANGELOG.md
```

### 3.2 Target Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    @boomerang/opencode-plugin                │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │  Plugin      │      │  Memory      │      │  Python   │ │
│  │  (index.ts)  │─────→│  Engine      │─────→│  Process  │ │
│  │              │      │  (stdio      │      │  (lancedb │ │
│  │  Automatic   │      │   JSON-RPC)  │      │   + ST)   │ │
│  │  memory ops  │      │              │      │           │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                                                    │
│         ↓                                                    │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  Bundled     │      │  Bundled     │                     │
│  │  Agents      │      │  Skills      │                     │
│  │  (markdown)  │      │  (markdown)  │                     │
│  └──────────────┘      └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

**Key changes:**
1. Super-memory runs as child process of plugin
2. Communication via stdin/stdout JSON-RPC (no network)
3. Memory operations are automatic, not tool calls
4. Agents/skills loaded from package directory via `__dirname`

---

## 4. Super-Memory Integration Strategy

### 4.1 Approach: Bundled Python Subprocess

#### 4.1.1 How It Works

1. **Plugin initialization** spawns Python process:
   ```typescript
   const pythonPath = path.join(__dirname, '../super-memory/.venv/bin/python');
   const superMemoryProcess = spawn(pythonPath, ['-m', 'super_memory'], {
     cwd: path.join(__dirname, '../super-memory'),
     stdio: ['pipe', 'pipe', 'pipe']
   });
   ```

2. **Communication** via JSON-RPC over stdin/stdout:
   ```typescript
   // Send request
   const request = {
     jsonrpc: '2.0',
     method: 'search',
     params: { query: '...', limit: 5 },
     id: 1
   };
   superMemoryProcess.stdin.write(JSON.stringify(request) + '\n');

   // Receive response
   superMemoryProcess.stdout.on('data', (data) => {
     const response = JSON.parse(data.toString());
     // Handle response
   });
   ```

3. **Lifecycle management**:
   - Start on plugin load
   - Health checks every 30s
   - Auto-restart on crash
   - Graceful shutdown on plugin unload

#### 4.1.2 Why This Approach

| Criterion | Subprocess (B) | TypeScript Port (A) | Internal HTTP (C) |
|-----------|---------------|---------------------|-------------------|
| Implementation effort | Low | Very High | Medium |
| Risk | Low | High (lancedb npm unproven) | Medium |
| Performance | Good (local stdio) | Good | Good (localhost) |
| Reliability | High (proven code) | Unknown | Medium |
| Maintenance | Low (reuse Python) | High (dual codebase) | Medium |
| User experience | Seamless | Seamless | Seamless |
| **Recommendation** | **✅ Best** | ❌ Too risky | ❌ Unnecessary complexity |

#### 4.1.3 Python Environment Setup

The bundled super-memory needs a Python environment. Options:

**Option 1: Expect system Python + auto-install dependencies** (Recommended)
- Check for Python 3.13+ on plugin init
- Create virtual environment in `super-memory/.venv/`
- Install dependencies via `pip install -e .`
- Store venv in plugin's data directory (e.g., `~/.config/opencode/plugins/boomerang/`)

**Option 2: Bundle pre-built venv** (Not recommended)
- Platform-specific binaries
- Bloated package size
- Security concerns

**Option 3: Use uv for fast setup** (Alternative)
- `uv` is fast and reliable
- Can auto-install if `uv` is available
- Fallback to pip if not

#### 4.1.4 Data Storage

Memory data should be stored in the user's config directory, not the package directory:

```typescript
const memoryDataDir = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'),
  'opencode-boomerang',
  'memory'
);
```

This ensures:
- Memory persists across package updates
- Multiple projects can share memory (or use project-specific subdirs)
- No write permissions needed in node_modules

---

## 5. Package Structure

### 5.1 package.json

```json
{
  "name": "@boomerang/opencode-plugin",
  "version": "1.0.0",
  "description": "Multi-agent orchestration plugin for OpenCode with Boomerang Protocol",
  "main": "dist/index.js",
  "type": "module",
  "files": [
    "dist/",
    "agents/",
    "skills/",
    "super-memory/",
    "package.json",
    "README.md",
    "LICENSE"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build && npm run verify-assets",
    "verify-assets": "node scripts/verify-assets.js"
  },
  "keywords": [
    "opencode",
    "plugin",
    "multi-agent",
    "orchestration",
    "boomerang-protocol"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/boomerang/opencode-plugin"
  },
  "license": "MIT",
  "dependencies": {
    "@opencode-ai/plugin": "^1.4.3",
    "@opencode-ai/sdk": "^1.4.6",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "opencode": {
    "plugin": true,
    "agentsDir": "./agents",
    "skillsDir": "./skills"
  }
}
```

### 5.2 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "super-memory"]
}
```

---

## 6. File Migration Matrix

### 6.1 Files to Move

| Source | Destination | Action |
|--------|-------------|--------|
| `.opencode/plugins/boomerang/src/*.ts` | `packages/opencode-plugin/src/*.ts` | Move |
| `.opencode/plugins/boomerang/package.json` | `packages/opencode-plugin/package.json` | Move + modify |
| `.opencode/plugins/boomerang/tsconfig.json` | `packages/opencode-plugin/tsconfig.json` | Move + modify |
| `.opencode/agents/*.md` | `packages/opencode-plugin/agents/*.md` | Move |
| `.opencode/skills/*/SKILL.md` | `packages/opencode-plugin/skills/*/SKILL.md` | Move |
| `.opencode/plugins/boomerang/tests/` | `packages/opencode-plugin/tests/` | Move |

### 6.2 Files to Create

| File | Purpose |
|------|---------|
| `packages/opencode-plugin/src/asset-loader.ts` | Load bundled agents/skills from package directory |
| `packages/opencode-plugin/src/memory-engine.ts` | Manage super-memory subprocess lifecycle |
| `packages/opencode-plugin/src/native-memory.ts` | Replace memory.ts with native subprocess client |
| `packages/opencode-plugin/super-memory/` | Copy of Super-Memory Python project |
| `packages/opencode-plugin/scripts/verify-assets.js` | Build-time asset verification |

### 6.3 Files to Delete

| File | Reason |
|------|--------|
| `src/opencode_boomerang/` | Python package—no longer needed |
| `releases/opencode-boomerang/` | Release artifacts—use npm publish |
| `pyproject.toml` | Python build config—no longer needed |
| `uv.lock` | Python lockfile—no longer needed |
| `.opencode/plugins/boomerang/` | Old plugin location—moved to packages/ |
| `.opencode/agents/` | Old agents location—moved to package |
| `.opencode/skills/` | Old skills location—moved to package |

### 6.4 Files to Modify

| File | Changes |
|------|---------|
| `src/index.ts` | Remove MCP memory tools, add automatic memory hooks, integrate asset loader |
| `src/memory.ts` | Replace HTTP client with subprocess client |
| `src/orchestrator.ts` | Remove manual memory calls (now automatic) |
| `README.md` | Update installation instructions |

---

## 7. Build & Publishing Process

### 7.1 Build Pipeline

```bash
# 1. TypeScript compilation
npm run build

# 2. Verify assets are present
npm run verify-assets

# 3. Run tests
npm run test

# 4. Publish to NPM
npm publish --access public
```

### 7.2 verify-assets.js Script

```javascript
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
```

### 7.3 Publishing Checklist

- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] All tests passing
- [ ] Assets verified
- [ ] TypeScript compilation successful
- [ ] README.md reflects new installation method
- [ ] `npm publish --access public`

---

## 8. Configuration Changes

### 8.1 Asset Discovery

The plugin will use `__dirname` to locate bundled assets:

```typescript
// src/asset-loader.ts
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getAssetPath(type: 'agents' | 'skills'): string {
  return path.join(__dirname, '..', type);
}

export function loadAgentDefinition(agentName: string): string {
  const agentPath = path.join(getAssetPath('agents'), `${agentName}.md`);
  if (!fs.existsSync(agentPath)) {
    throw new Error(`Agent definition not found: ${agentName}`);
  }
  return fs.readFileSync(agentPath, 'utf-8');
}

export function loadSkillDefinition(skillName: string): string {
  const skillPath = path.join(getAssetPath('skills'), skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill definition not found: ${skillName}`);
  }
  return fs.readFileSync(skillPath, 'utf-8');
}

export function listAvailableAgents(): string[] {
  const agentsDir = getAssetPath('agents');
  return fs.readdirSync(agentsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

export function listAvailableSkills(): string[] {
  const skillsDir = getAssetPath('skills');
  return fs.readdirSync(skillsDir)
    .filter(d => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')));
}
```

### 8.2 Memory Configuration

Remove memory-specific config (now always enabled):

```typescript
// BEFORE (current)
interface BoomerangConfig {
  memoryEnabled: boolean;
  memoryTierConfig: MemoryTierConfig;
  // ...
}

// AFTER (migrated)
interface BoomerangConfig {
  // memoryEnabled removed—always on
  // memoryTierConfig removed—use defaults or env vars
  embeddingStrategy: 'TIERED' | 'PARALLEL';
  // ...
}
```

### 8.3 Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `BOOMERANG_MEMORY_DIR` | Memory data directory | `~/.local/share/opencode-boomerang/memory` |
| `BOOMERANG_EMBEDDING_STRATEGY` | Search strategy | `TIERED` |
| `BOOMERANG_BGE_THRESHOLD` | Confidence threshold | `0.72` |
| `BOOMERANG_PYTHON_PATH` | Custom Python path | auto-detect |
| `BOOMERANG_AUTO_MEMORY` | Enable automatic memory | `true` |

---

## 9. Implementation Steps

### Phase 1: Repository Restructuring (Day 1)

**Goal:** Establish new directory structure

```bash
# 1. Create new package directory
mkdir -p packages/opencode-plugin

# 2. Move plugin source
cp -r .opencode/plugins/boomerang/src packages/opencode-plugin/
cp .opencode/plugins/boomerang/tsconfig.json packages/opencode-plugin/

# 3. Move agents and skills
cp -r .opencode/agents packages/opencode-plugin/
cp -r .opencode/skills packages/opencode-plugin/

# 4. Copy super-memory Python code
cp -r /home/jcharles/Projects/MCP-Servers/Super-Memory/* packages/opencode-plugin/super-memory/

# 5. Create new package.json
cat > packages/opencode-plugin/package.json << 'EOF'
{
  "name": "@boomerang/opencode-plugin",
  "version": "1.0.0",
  "description": "Multi-agent orchestration plugin for OpenCode",
  "main": "dist/index.js",
  "type": "module",
  "files": [
    "dist/",
    "agents/",
    "skills/",
    "super-memory/",
    "package.json",
    "README.md",
    "LICENSE"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prepublishOnly": "npm run build && npm run verify-assets",
    "verify-assets": "node scripts/verify-assets.js"
  },
  "dependencies": {
    "@opencode-ai/plugin": "^1.4.3",
    "@opencode-ai/sdk": "^1.4.6",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.0"
  },
  "license": "MIT"
}
EOF

# 6. Update tsconfig.json to exclude super-memory
cat > packages/opencode-plugin/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "super-memory"]
}
EOF
```

### Phase 2: Core Implementation (Days 2-4)

**Goal:** Implement subprocess memory engine and asset loader

#### Step 2.1: Create memory-engine.ts

```typescript
// src/memory-engine.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: number;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: { code: number; message: string };
  id: number;
}

export class MemoryEngine {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private ready = false;
  private readyCallbacks: Function[] = [];
  private memoryDataDir: string;

  constructor() {
    this.memoryDataDir = process.env.BOOMERANG_MEMORY_DIR || path.join(
      os.homedir(),
      '.local/share/opencode-boomerang/memory'
    );
  }

  async start(): Promise<void> {
    if (this.process) return;

    // Ensure memory data directory exists
    fs.mkdirSync(this.memoryDataDir, { recursive: true });

    // Find Python executable
    const pythonPath = await this.findPython();
    const superMemoryDir = path.join(__dirname, '..', 'super-memory');

    // Set up environment
    const env = {
      ...process.env,
      MEMORY_DATA_DIR: this.memoryDataDir,
      PYTHONPATH: path.join(superMemoryDir, 'src'),
    };

    // Spawn Python process
    this.process = spawn(pythonPath, ['-m', 'super_memory'], {
      cwd: superMemoryDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleResponse(data.toString());
    });

    // Handle stderr (logging)
    this.process.stderr?.on('data', (data: Buffer) => {
      console.log(`[super-memory] ${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      console.log(`Super-memory process exited with code ${code}`);
      this.process = null;
      this.ready = false;
    });

    // Wait for ready signal
    await this.waitForReady();
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.process.kill('SIGTERM');
    // Force kill after 5s if still running
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 5000);
  }

  async call(method: string, params?: any): Promise<any> {
    if (!this.process?.stdin) {
      throw new Error('Memory engine not started');
    }

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + '\n');

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} timed out`));
        }
      }, 30000);
    });
  }

  private handleResponse(data: string): void {
    try {
      const lines = data.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const response: JSONRPCResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse memory response:', err);
    }
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ready) {
        resolve();
        return;
      }
      this.readyCallbacks.push(resolve);
      // Timeout after 10s
      setTimeout(() => {
        if (!this.ready) {
          console.warn('Memory engine startup timeout');
          resolve(); // Resolve anyway to not block
        }
      }, 10000);
    });
  }

  private async findPython(): Promise<string> {
    // Check env override
    if (process.env.BOOMERANG_PYTHON_PATH) {
      return process.env.BOOMERANG_PYTHON_PATH;
    }

    // Check common paths
    const candidates = [
      'python3.13',
      'python3.12',
      'python3.11',
      'python3',
      'python',
    ];

    for (const cmd of candidates) {
      try {
        const result = await new Promise<string>((resolve, reject) => {
          const proc = spawn(cmd, ['--version']);
          let output = '';
          proc.stdout?.on('data', (d) => output += d);
          proc.on('exit', (code) => {
            if (code === 0 && output.includes('3.')) {
              resolve(cmd);
            } else {
              reject();
            }
          });
        });
        return result;
      } catch {
        continue;
      }
    }

    throw new Error('Python 3.11+ not found. Install Python or set BOOMERANG_PYTHON_PATH.');
  }
}

export const memoryEngine = new MemoryEngine();
```

#### Step 2.2: Create native-memory.ts

```typescript
// src/native-memory.ts
import { MemoryEngine, memoryEngine } from './memory-engine.js';
import { MemorySearchResult, MemoryAddResult, MemorySaveLongResult, MemoryEntry, EmbeddingStrategy } from './types.js';

export class NativeBoomerangMemory {
  private engine: MemoryEngine;

  constructor(engine: MemoryEngine = memoryEngine) {
    this.engine = engine;
  }

  async addMemory(
    content: string,
    tags?: string[],
    project?: string,
    metadata?: Record<string, any>
  ): Promise<MemoryAddResult> {
    try {
      const result = await this.engine.call('add', {
        content,
        tags,
        metadata: { ...metadata, project },
      });
      return { success: true, id: result.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async addMemoryLong(
    content: string,
    project: string,
    tags?: string[],
    metadata?: Record<string, any>,
    forceHighPrecision = true
  ): Promise<MemorySaveLongResult> {
    try {
      const result = await this.engine.call('save_memory_long', {
        content,
        project,
        tags,
        metadata: { ...metadata, force_high_precision: forceHighPrecision },
      });
      return {
        success: true,
        id: result.id,
        embeddingModel: 'bge-large',
        dimensions: 1024,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async searchMemory(
    query: string,
    limit = 5,
    project?: string,
    strategy?: EmbeddingStrategy
  ): Promise<MemorySearchResult> {
    try {
      const method = strategy === 'PARALLEL' ? 'search_parallel' : 'search';
      const results = await this.engine.call(method, { query, limit, project });
      return {
        success: true,
        results: results.map((r: any) => ({
          id: r.id,
          content: r.content,
          tags: r.tags,
          createdAt: r.created_at,
          sourceModel: r.metadata?.source_model || 'minilm',
          tier: r.metadata?.tier || 'transient',
          project: r.metadata?.project,
          metadata: r.metadata,
        })),
        strategy: strategy || 'TIERED',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  formatContextForInjection(searchResults: MemoryEntry[]): string {
    if (searchResults.length === 0) return '';
    let context = '\n\n## Relevant Past Context (from memory)\n\n';
    for (const result of searchResults) {
      const tierLabel = result.tier ? `[${result.tier}]` : '';
      context += `- ${tierLabel} ${result.content}\n`;
    }
    context += '\n';
    return context;
  }
}

export const boomerangMemory = new NativeBoomerangMemory();
```

#### Step 2.3: Update index.ts

```typescript
// src/index.ts (key changes)
import { tool } from "@opencode-ai/plugin";
import { createBoomerangOrchestrator } from "./orchestrator.js";
import { NativeBoomerangMemory, boomerangMemory } from "./native-memory.js";
import { memoryEngine } from "./memory-engine.js";
import { generateSessionSummary } from "./session-utils.js";
// ... other imports

// Remove memoryEnabled from config—memory is always on
const DEFAULT_CONFIG: BoomerangConfig = {
  // ... other config
  // memoryEnabled: true,  // REMOVED
  // memoryTierConfig: {...},  // REMOVED
  embeddingStrategy: (process.env.BOOMERANG_EMBEDDING_STRATEGY as EmbeddingStrategy) || "TIERED",
};

export const BoomerangPlugin = async (ctx: PluginContext): Promise<any> => {
  const config = DEFAULT_CONFIG;

  // Initialize memory engine on plugin load
  try {
    await memoryEngine.start();
    ctx.client.app.log("Super-memory engine started");
  } catch (err) {
    ctx.client.app.log(`Failed to start super-memory: ${err}`);
  }

  return {
    tool: {
      // ... other tools

      // REMOVED: boomerang_memory_search (no longer exposed as tool)
      // REMOVED: boomerang_memory_add
      // REMOVED: boomerang_memory_save_long
      // REMOVED: boomerang_memory_search_tiered
      // REMOVED: boomerang_memory_search_parallel

      // Keep boomerang_status, boomerang_plan, boomerang_execute
      // Keep boomerang_git_check, boomerang_quality_gates
      // Keep boomerang_compact
    },

    event: async ({ event }: { event: any }) => {
      const eventType = event.type;

      if (eventType === "session.created") {
        const sessionId = event.sessionId || event.id;

        // AUTOMATIC: Query memory on session start
        try {
          const memResult = await boomerangMemory.searchMemory("recent boomerang session context");
          if (memResult.success && memResult.results && memResult.results.length > 0) {
            const memoryContext = boomerangMemory.formatContextForInjection(memResult.results);
            await ctx.client.session.prompt({
              path: { id: sessionId },
              body: {
                parts: [{
                  type: "text",
                  text: `\n\n[INJECTED FROM SUPER-MEMORY - Previous Context]\n${memoryContext}\n`,
                }],
                noReply: true,
              },
            });
            ctx.client.app.log(`Injected ${memResult.results.length} memories into session`);
          }
        } catch (err) {
          ctx.client.app.log(`Memory injection failed: ${err}`);
        }
      }

      if (eventType === "session.compacted") {
        const sessionId = event.sessionId || event.id;
        // AUTOMATIC: Save session summary on compaction
        const session = getSessionState(sessionId);
        if (session) {
          const summary = generateSessionSummary(session);
          await boomerangMemory.addMemoryLong(summary, "boomerang-session", ["boomerang", "session", "compacted"]);
        }
      }
    },

    // AUTOMATIC: Save memory after task completion
    "tool.execute.after": async (event: { tool: string }, output: any) => {
      // ... existing git logic

      // Save task result to memory
      try {
        await boomerangMemory.addMemory(
          `Tool ${event.tool} executed. Output: ${JSON.stringify(output).substring(0, 500)}`,
          ["tool-execution", event.tool]
        );
      } catch (err) {
        // Non-critical—don't fail the tool execution
        ctx.client.app.log(`Memory save failed: ${err}`);
      }
    },

    // Cleanup on plugin unload
    cleanup: async () => {
      await memoryEngine.stop();
    },
  };
};
```

### Phase 3: Cleanup (Day 5)

**Goal:** Remove old artifacts

```bash
# Remove old Python package
rm -rf src/opencode_boomerang

# Remove old release artifacts
rm -rf releases/opencode-boomerang

# Remove Python build files
rm pyproject.toml uv.lock

# Remove old plugin location (after verifying new one works)
rm -rf .opencode/plugins/boomerang
rm -rf .opencode/agents
rm -rf .opencode/skills

# Update root .gitignore
cat >> .gitignore << 'EOF'
# Python artifacts (legacy)
*.egg-info/
dist/*.tar.gz

# Node artifacts
node_modules/
dist/
EOF
```

### Phase 4: Testing & Publishing (Day 6-7)

**Goal:** Validate and publish

```bash
cd packages/opencode-plugin

# Install dependencies
npm install

# Build
npm run build

# Verify assets
npm run verify-assets

# Run tests
npm run test

# Dry-run publish
npm publish --dry-run

# Publish
npm publish --access public
```

---

## 10. Code Examples

### 10.1 Automatic Memory on Plugin Init

```typescript
// In plugin initialization
export const BoomerangPlugin = async (ctx: PluginContext): Promise<any> => {
  // Start memory engine automatically
  await memoryEngine.start();

  return {
    // ... tools and events

    // Automatic memory injection on every session
    event: async ({ event }) => {
      if (event.type === "session.created") {
        // Query memory automatically—no user action needed
        const context = await boomerangMemory.searchMemory("recent work context");
        if (context.results) {
          // Inject into session automatically
          await injectContext(event.sessionId, context);
        }
      }
    },
  };
};
```

### 10.2 Loading Bundled Agents

```typescript
// src/asset-loader.ts
import { getAssetPath, loadAgentDefinition } from './asset-loader.js';

// In orchestrator or task-executor
const agentPrompt = loadAgentDefinition('boomerang-coder');
console.log(`Loaded agent prompt (${agentPrompt.length} chars) from bundled assets`);

// List all available agents
const agents = listAvailableAgents();
console.log('Available agents:', agents.join(', '));
```

### 10.3 Subprocess Health Check

```typescript
// In memory-engine.ts
private startHealthCheck(): void {
  setInterval(async () => {
    if (!this.process || this.process.killed) {
      console.warn('Memory engine down—restarting...');
      await this.start();
    }
  }, 30000); // Check every 30s
}
```

### 10.4 Graceful Shutdown

```typescript
// In plugin cleanup
process.on('SIGINT', async () => {
  await memoryEngine.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await memoryEngine.stop();
  process.exit(0);
});
```

---

## 11. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Python not installed on target system | Medium | High | Clear error message; provide setup script; document Python requirement |
| Super-memory subprocess crashes | Low | High | Auto-restart with health checks; fallback to no-memory mode |
| Large package size (Python code) | High | Medium | Only bundle source (no venv); .npmignore excludes tests/docs |
| lancedb npm package matures | Low | Medium | Future migration path to TypeScript port documented |
| Asset loading fails (path issues) | Low | High | Use `__dirname` resolution; verify-assets script at build time |
| Memory data corruption | Low | High | Regular backups; use lancedb transactions; data directory outside package |
| Plugin conflicts with other OpenCode plugins | Low | Medium | Namespace all tools with `boomerang_` prefix |

---

## Appendix A: Migration Checklist

### Pre-Migration
- [ ] Backup current repository
- [ ] Document current Python dependencies
- [ ] Verify all tests pass in current state
- [ ] Notify users of breaking changes

### Migration
- [ ] Create `packages/opencode-plugin/` structure
- [ ] Move TypeScript source files
- [ ] Move agent markdown files
- [ ] Move skill markdown files
- [ ] Copy super-memory Python code
- [ ] Implement `memory-engine.ts`
- [ ] Implement `native-memory.ts`
- [ ] Implement `asset-loader.ts`
- [ ] Update `index.ts` (remove MCP memory tools)
- [ ] Update `orchestrator.ts` (remove manual memory calls)
- [ ] Update `package.json` with new name and files
- [ ] Create `verify-assets.js` script
- [ ] Update README.md

### Post-Migration
- [ ] Delete old directories (`src/`, `releases/`, `.opencode/plugins/`, etc.)
- [ ] Remove `pyproject.toml` and `uv.lock`
- [ ] Update root `.gitignore`
- [ ] Run full test suite
- [ ] Verify asset loading works
- [ ] Verify memory engine starts/stops correctly
- [ ] Verify agents load from bundled directory
- [ ] Verify skills load from bundled directory
- [ ] Publish to NPM
- [ ] Update installation documentation
- [ ] Archive old Python repository (optional)

---

## Appendix B: Alternative Super-Memory Approaches

### Option A: TypeScript Port (Future Consideration)

If `@lancedb/lancedb` npm package matures:

```typescript
// Hypothetical future implementation
import * as lancedb from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';

export class TypeScriptMemoryEngine {
  private db: lancedb.Connection;
  private embedder: any;

  async init() {
    this.db = await lancedb.connect('~/.local/share/opencode-boomerang/memory');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async add(content: string, metadata?: any) {
    const embedding = await this.embedder(content, { pooling: 'mean', normalize: true });
    const table = await this.db.openTable('memories');
    await table.add([{ content, embedding, metadata }]);
  }
}
```

**Pros:** Single runtime, no Python dependency  
**Cons:** lancedb npm is experimental; sentence-transformers not available; major rewrite

### Option C: Internal HTTP (Not Recommended)

Keep HTTP API but don't expose as MCP tools:

```typescript
// memory.ts (modified)
const apiUrl = 'http://localhost:8080'; // Local only, not external

async function searchMemory(query: string) {
  // Internal HTTP call—no user choice
  return fetch(`${apiUrl}/search`, { ... });
}
```

**Pros:** Simple, keeps current architecture  
**Cons:** Still requires separate super-memory process; network dependency; not truly bundled

---

## Summary

This migration plan transforms Boomerang from a hybrid Python/TypeScript project into a **pure NPM package** with:

1. **Bundled super-memory** via Python subprocess (automatic, mandatory)
2. **Bundled agents and skills** (no manual installation)
3. **Automatic memory operations** (like git gates—no user choice)
4. **Clean package structure** (single concern, single package)

The recommended approach minimizes risk by preserving the proven super-memory Python codebase while achieving the goal of a seamless, automatic memory system.

**Estimated effort:** 5-7 days  
**Risk level:** Low-Medium  
**Breaking changes:** Yes (major version bump to 1.0.0)
