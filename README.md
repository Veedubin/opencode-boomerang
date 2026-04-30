# 🚀 Boomerang for OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![v3.0.0](https://img.shields.io/badge/v3.0.0-Qdrant%20Migration-2ecc71?style=flat-square)](https://github.com/Veedubin/opencode-boomerang/releases/tag/plugin-v3.0.0)

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

---

## 🎉 v3.0.0 Highlights

> **BREAKING: LanceDB → Qdrant Migration** — boomerang-v2 now uses Super-Memory-TS natively with Qdrant backend.

| Feature | Description |
|---------|-------------|
| **Qdrant Backend** | Vector storage via Super-Memory-TS with Qdrant |
| **Project Isolation** | `BOOMERANG_PROJECT_ID` env var for multi-project support |
| **Health Diagnostics** | `get_status` tool for connection health checks |
| **Migration Script** | `npm run migrate-memory` for LanceDB → Qdrant data migration |
| **Connection Resilience** | Exponential backoff retry for Qdrant connections |

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
| `npx vitest run` | Run test suite |

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

| Tier | Description | Agents |
|------|-------------|--------|
| **Orchestrator** | Top-level coordinator | boomerang |
| **Primary Tier Agents** | Design, research, orchestration | architect, writer, handoff, init |
| **Secondary Tier Agents** | Implementation, tools | coder, explorer, tester, linter, git, scraper, researcher, mcp-specialist, release |

**NO SPAWNING** — Sub-agents do not spawn child agents.

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
| **boomerang-init** | boomerang-init | Kimi K2.6 | 🎬 **Initialization** — Project setup and agent personalization |
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

## 🧠 Memory System

Boomerang uses **Qdrant** via Super-Memory-TS for vector storage.

### Setup

Start Qdrant (required):

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `BOOMERANG_PROJECT_ID` | `default` | Project isolation ID |

### Memory Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Query | `memoryService.queryMemories()` | Semantic search across sessions |
| Save | `memoryService.addMemory()` | Store decisions and learnings |
| Project Search | `memoryService.searchProject()` | Search indexed project files |
| Index | `memoryService.indexProject()` | Trigger project re-indexing |
| Health | `get_status` | Check Qdrant connection health |

### Migrating from LanceDB

If you have existing LanceDB data, migrate with:

```bash
npm run migrate-memory -- --lancedb-uri ./memory_data --qdrant-url http://localhost:6333
```

Add `--resume` to continue an interrupted migration.

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
│   ├── memory/               # Memory adapter (Super-Memory-TS wrapper)
│   ├── memory-service.ts      # Public API wrapper
│   ├── protocol/             # Protocol tracking
│   └── agents/               # Agent definitions
├── scripts/
│   └── migrate-lancedb-to-qdrant.ts  # Migration script
├── dist/                     # Built output
├── package.json              # @veedubin/boomerang-v2
└── README.md
```

---

## 📦 Integration with Super-Memory-TS

### Built-in Integration (Boomerang Users)

Memory is automatically initialized on plugin load. Requires Qdrant:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### External MCP Server (Non-Boomerang Users)

Use the standalone Super-Memory-TS MCP server:

```bash
npm install @veedubin/super-memory-ts
npx super-memory-ts
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

- **v3.0.0** — LanceDB → Qdrant migration complete
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