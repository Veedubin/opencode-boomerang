# 🚀 Boomerang for OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![v2.3.10](https://img.shields.io/badge/v2.3.10-Dual--Mode%20Memory-2ecc71?style=flat-square)]()

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

---

## 🎉 v2.3.10 Highlights

> **Connection Fix + Version Sync** — Resolved "Not connected" root cause and sub-package version mismatch.

| Feature | Description |
|---------|-------------|
| **Connection Fix** | Removed broken `isTransportConnected()` check causing "Not connected" errors |
| **Version Sync** | Root and sub-package (`packages/opencode-plugin/`) versions now aligned |
| **Dual-Mode Memory** | Built-in direct import (zero overhead) or MCP external server |
| **Agent Governance** | Code-level enforced rules — architect owns research, explorer is file-finding only |
| **Context Management** | Smart eviction at 70%, compaction at 85% — Claude 200k→180k window |
| **CI Stabilization** | 95 critical tests passing |
| **Database Migration** | LanceDB → Qdrant for improved vector performance |

---

## 🚚 Quick Start

### Installation

```bash
npm install @veedubin/boomerang-v2
```

### Configuration

Add to your `.opencode/opencode.json`:

```json
{
  "plugin": ["@veedubin/boomerang-v2"],
  "mcp": {
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    }
  }
}
```

### Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Build TypeScript to `dist/` |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint |
| `bun test` | Run test suite |

---

## 🏗️ Architecture

### Dual-Mode Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              🎯 ORCHESTRATOR (Kimi K2.6)                         │
│   • Plans task execution & dependency graph                       │
│   • Delegates to specialized sub-agents                          │
│   • Enforces quality gates                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   💻        │      │   🏗️        │      │   🔍        │
│  CODER      │      │ ARCHITECT  │      │ EXPLORER   │
│ MiniMax M2.7│      │ Kimi K2.6  │      │ MiniMax M2.7│
└─────────────┘      └─────────────┘      └─────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🧠 MEMORY SYSTEM                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   BUILT-IN MODE     │    │   MCP EXTERNAL      │             │
│  │   (Direct Import)   │    │   (Standalone)       │             │
│  │   Zero overhead     │    │   For non-Boomerang  │             │
│  │   @veedubin/        │    │   users              │             │
│  │   boomerang-v2      │    │                     │             │
│  └─────────────────────┘    └─────────────────────┘             │
│                                                                 │
│   • Project indexing on startup                                  │
│   • Background file watching (chokidar)                         │
│   • Per-project database isolation                               │
└─────────────────────────────────────────────────────────────────┘
```

### The 6-Step Boomerang Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│                    6-STEP BOOMERANG PROTOCOL                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1️⃣ MEMORY          → Query super-memory for context           │
│          ↓                                                      │
│   2️⃣ THINK & PLAN     → Analyze task, build dependency graph     │
│          ↓                                                      │
│   3️⃣ DELEGATE         → Assign work to specialized agents       │
│          ↓                                                      │
│   4️⃣ GIT CHECK        → Verify changes, stage, commit           │
│          ↓                                                      │
│   5️⃣ QUALITY GATES    → Run lint, typecheck, tests              │
│          ↓                                                      │
│   6️⃣ SAVE MEMORY      → Persist decisions back to super-memory   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Agent Roster

| Agent | Skill | Model | Role |
|-------|-------|-------|------|
| **boomerang** | boomerang-orchestrator | Kimi K2.6 | 🎯 **Orchestrator** — Plans, coordinates, enforces protocol |
| **boomerang-coder** | boomerang-coder | MiniMax M2.7 | 💻 **Fast code generation** — TypeScript/Python |
| **boomerang-architect** | boomerang-architect | Kimi K2.6 | 🏗️ **Design decisions** — Trade-off analysis and architecture |
| **boomerang-explorer** | boomerang-explorer | MiniMax M2.7 | 🔍 **Codebase exploration** — Find files by name/glob |
| **boomerang-tester** | boomerang-tester | MiniMax M2.7 | 🧪 **Testing specialist** — Unit/integration tests |
| **boomerang-linter** | boomerang-linter | MiniMax M2.7 | ✅ **Quality enforcement** — ESLint, typecheck |
| **boomerang-git** | boomerang-git | MiniMax M2.7 | 📦 **Version control** — Multi-package commits |
| **boomerang-writer** | boomerang-writer | Kimi K2.6 | 📝 **Documentation** — Markdown writing |
| **boomerang-scraper** | boomerang-scraper | MiniMax M2.7 | 🌐 **Web scraping** — Research and data gathering |
| **boomerang-handoff** | boomerang-handoff | Kimi K2.6 | 🔄 **Session wrap-up** — Context saving |
| **researcher** | researcher | MiniMax M2.7 | 🌐 **Web research** — Search & synthesis |
| **mcp-specialist** | mcp-specialist | MiniMax M2.7 | 🔌 **MCP Protocol** — Tool design, server debug |

---

## Agent Governance (v2.3.2+)

> **⚠️ CODE-LEVEL ENFORCED** — These rules are not optional guidelines.

### Research Ownership
- **boomerang-architect** owns ALL research tasks (web searches, code analysis, documentation review)
- boomerang-explorer is **file-finding only** — no pattern analysis or code research
- **super-memory_search_project** is the primary research tool

### Orchestration Rules
1. Research tasks → `boomerang-architect` (NOT explorer)
2. File finding → `boomerang-explorer` (only for glob/find operations)
3. Code implementation → `boomerang-coder`
4. Never delegate research to explorer — architect handles it

### Agent Scope Boundaries

| Agent | Scope |
|-------|-------|
| boomerang-explorer | Find files by name/glob ONLY |
| boomerang-architect | Design + Research + Code analysis |
| boomerang-coder | Code implementation |
| boomerang-tester | Test writing |
| boomerang-linter | Quality enforcement |
| mcp-specialist | MCP tool design & server debug |

---

## 📊 Context Management

### Window Management
- **Claude 200k→180k window** — 10% reserved for protocol overhead
- **Smart eviction at 70%** — Low-value outputs offloaded to temp files
- **Compaction at 85%** — Session wrap-up triggered, fresh context

### Eviction Strategy
```
70% context usage → Evict tool outputs >500 words
85% context usage → Trigger /handoff skill, save state
```

---

## 🔒 Security

### Vulnerability Register

| Package | Status | Notes |
|---------|--------|-------|
| **uuid** | ✅ Fixed | Updated to patched version |
| **@modelcontextprotocol/sdk** | ⚠️ Accepted | Monitoring, no alternative |
| **protobufjs** | ⚠️ Accepted | Monitoring, no alternative |

---

## 🧠 Built-in Memory Integration

Boomerang uses **direct module imports** for zero-overhead memory access:

```typescript
import { MemorySystem } from './memory/index.js';
import { getMemoryService } from './memory-service.js';
```

### Memory Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Query | `memoryService.queryMemories()` | Semantic search across sessions |
| Save | `memoryService.addMemory()` | Store decisions and learnings |
| Project Search | `memoryService.searchProject()` | Search indexed project files |
| Index | `memoryService.indexProject()` | Trigger project re-indexing |

### Integration with Super-Memory-TS

Boomerang uses `@veedubin/super-memory-ts` for vector storage:
- **Built-in Mode**: Direct import (zero overhead)
- **MCP Mode**: External stdio server for non-Boomerang users

---

## 🏆 Key Achievements

| Achievement | Version | Description |
|-------------|---------|-------------|
| **18-Item Completion** | v2.3.10 | All security, feature, CI, and test work items done |
| **Connection Fix** | v2.3.10 | Removed broken transport check causing "Not connected" |
| **Agent Governance** | v2.3.2 | Code-level enforced rules, architect owns research |
| **CI Stabilization** | v2.3.6 | 95 critical tests passing |
| **Database Migration** | v2.0.0 | LanceDB → Qdrant for improved performance |
| **Dual-Mode Memory** | v2.3.8 | Built-in direct import vs MCP external |

---

## 📁 Project Structure

```
boomerang-v2/
├── src/
│   ├── index.ts              # Main entry point
│   ├── memory/               # Built-in memory system
│   │   ├── index.ts          # MemorySystem exports
│   │   └── database.ts       # LanceDB pool
│   ├── project-index/        # Project indexing
│   │   ├── search.ts         # Vector search
│   │   ├── indexer.ts        # File watcher
│   │   └── types.ts          # Type definitions
│   ├── memory-service.ts     # Public API wrapper
│   ├── protocol/             # Protocol tracking
│   └── agents/               # Agent definitions
├── dist/                     # Built output
├── package.json             # @veedubin/boomerang-v2
└── README.md
```

---

## 📦 Integration with Super-Memory-TS

### For Boomerang Users (Built-in)

Memory is automatically initialized on plugin load. No additional configuration needed.

### For External Users (MCP)

Use the standalone Super-Memory-TS MCP server:

```bash
npm install @veedubin/super-memory-ts
node src/server.ts
```

### MCP Tools (External Mode)

| Tool | Description |
|------|-------------|
| `super-memory_query_memories` | Search memories |
| `super-memory_add_memory` | Store memory |
| `super-memory_search_project` | Search indexed files |
| `super-memory_index_project` | Trigger indexing |

---

## 🔄 Release Pipeline

### Publishing

| Package | Registry | Trigger |
|---------|----------|---------|
| `@veedubin/boomerang-v2` | NPM | `plugin-v*.*.*` tag |
| `@veedubin/super-memory-ts` | NPM | `v*.*.*` tag |

### Version History

- **v2.3.10** — Connection fix, version sync, all 18 items complete
- **v2.3.8** — Dual-mode memory architecture
- **v2.3.2** — Agent governance code-level enforced
- **v2.0.0** — LanceDB → Qdrant migration

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🚀 by [Veedubin](https://github.com/Veedubin)**

*Your AI development team, on demand.*

</div>