# 🚀 Boomerang for OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![v2.4.0](https://img.shields.io/badge/v2.4.0-8--Step%20Protocol-2ecc71?style=flat-square)](https://github.com/Veedubin/opencode-boomerang/releases/tag/plugin-v2.4.0)

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

---

## 🎉 v2.4.0 Highlights

> **Orchestration Overhaul** — 8-step protocol, Context Packages, and super-memory hub architecture.

| Feature | Description |
|---------|-------------|
| **8-Step Protocol** | Expanded from 6 steps: Query Memory → Think → Plan → Delegate → Git Check → Quality Gates → Update Docs → Save Memory |
| **Context Packages** | Complete context passed to sub-agents: original request, background, files, code snippets, decisions, output format, scope boundaries, error handling |
| **Planning Enforcement** | Planning is MANDATORY for build/create/implement tasks unless user explicitly waives |
| **Documentation Maintenance** | After EVERY session: update TASKS.md, todo list, AGENTS.md, README.md, HANDOFF.md |
| **Thin Response / Thick Memory** | Sub-agents return concise summaries + memory references; full details stored in Qdrant |
| **boomerang-release** | New agent for automated version bumping, changelog, and publishing |

---

## 🤖 Model Configuration

Boomerang uses a two-tier agent system. You can customize which LLM models power each tier during installation.

### Default Configuration

| Tier | Default Model | Agents |
|------|--------------|--------|
| **Primary** | Kimi K2.6 (`kimi-for-coding/k2p6`) | orchestrator, architect, writer, handoff, init |
| **Secondary** | MiniMax M2.7 (`minimax/MiniMax-M2.7`) | coder, explorer, tester, linter, git, scraper, researcher, mcp-specialist |

### Custom Models

Pass model arguments during installation:

```bash
# Use a single model for all agents
npx @veedubin/boomerang-v2 --primary=k2k6

# Use different models for primary and secondary tiers
npx @veedubin/boomerang-v2 --primary=claude-sonnet --secondary=gpt-4o-mini

# Install with defaults
npx @veedubin/boomerang-v2
```

### Supported Model Aliases

| Alias | OpenCode Model ID | Provider |
|-------|-------------------|----------|
| `k2k6` | `kimi-for-coding/k2p6` | Kimi |
| `k2k5` | `kimi-for-coding/k2p5` | Kimi |
| `m2k7` | `minimax/MiniMax-M2.7` | MiniMax |
| `m2k5` | `minimax/MiniMax-M2.5` | MiniMax |
| `claude-sonnet` | `anthropic/claude-sonnet-4-20250514` | Anthropic |
| `claude-opus` | `anthropic/claude-opus-4-20250514` | Anthropic |
| `gpt-4o` | `openai/gpt-4o` | OpenAI |
| `gpt-4o-mini` | `openai/gpt-4o-mini` | OpenAI |
| `gemini-pro` | `google/gemini-2.5-pro` | Google |
| `gemini-flash` | `google/gemini-2.5-flash` | Google |
| `deepseek` | `deepseek/deepseek-chat-v3` | DeepSeek |
| `llama3` | `meta/llama-3.3-70b` | Meta |
| `qwen` | `alibaba/qwen-2.5-72b` | Alibaba |

You can also pass any valid OpenCode model ID directly:
```bash
npx @veedubin/boomerang-v2 --primary=anthropic/claude-sonnet-4-20250514
```

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

### Context Passing
Boomerang uses a **Context Package** system where the orchestrator passes comprehensive context to sub-agents:
- Original user request (verbatim)
- Task background and constraints
- Relevant files and code snippets
- Expected output format
- Scope boundaries and escalation targets

This ensures sub-agents have everything they need to work effectively.

### Super-Memory Hub
Super-memory is the central knowledge base:
- **Query before responding** — Agents check memory for relevant context
- **Save after completing** — Agents save detailed work to memory
- **Thin responses** — Sub-agents return concise summaries + memory references
- **Thick memory** — Full details stored in Qdrant for future retrieval

### Agent Hierarchy
- **Orchestrator** — Top-level coordinator, handles planning and delegation
- **Primary Agents** — Architect (design/research), Coder (implementation)
- **Sub-agents** — Specialized tools (tester, linter, git, writer, etc.)
- **NO SPAWNING** — Sub-agents do not spawn child agents

### Planning Enforcement
Planning is mandatory for all build/create/implement tasks unless explicitly waived by the user.

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
| **boomerang-release** | boomerang-release | MiniMax M2.7 | 🚀 **Release automation** — Version bump, changelog, publish |
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