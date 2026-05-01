# 🚀 Boomerang for OpenCode

> **This package is the OpenCode plugin. For the standalone MCP server, see `@veedubin/super-memory-ts`.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![v3.1.0](https://img.shields.io/badge/v3.1.0-Protocol%20Enforcement-2ecc71?style=flat-square)](https://github.com/Veedubin/opencode-boomerang/releases/tag/plugin-v3.1.0)

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

---

## 🎉 v3.1.0 Highlights

> **Code-Enforced Protocol** — The Boomerang Protocol is now enforced via state machine with mandatory checkpoints.

| Feature | Description |
|---------|-------------|
| **State Machine Architecture** | Each protocol step is a mandatory checkpoint |
| **Real Agent Execution** | TaskRunner spawns actual subprocess (no simulation) |
| **Strictness Levels** | lenient/standard/strict configuration |
| **Documentation Tracking** | DocTracker with SHA-256 hash comparison |
| **Qdrant Memory** | Vector storage via Super-Memory-TS with built-in integration |
| **8-Step Protocol** | Memory → Think → Plan → Delegate → Git Check → Quality Gates → Docs → Memory Save |

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

### Memory Setup (Required)

Boomerang uses Qdrant for vector storage. Start with Docker:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Or use Docker Compose for persistent storage:
```bash
docker-compose up -d qdrant
```

### Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Build TypeScript to `dist/` |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint |
| `npx vitest run` | Run test suite |

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

## 🔒 Protocol Enforcement

The Boomerang Protocol is **code-enforced** via state machine with mandatory checkpoints.

### State Machine Flow

```
IDLE → MEMORY_QUERY → SEQUENTIAL_THINK → PLAN → DELEGATE → GIT_CHECK → QUALITY_GATES → DOC_UPDATE → MEMORY_SAVE → COMPLETE
```

### Strictness Levels

| Level | Behavior |
|-------|----------|
| **lenient** | Auto-fix skipped steps, warn but proceed |
| **standard** | Block on mandatory steps, require waiver for bypass (default) |
| **strict** | Block on all violations, no waivers except emergencies |

### Waiver Phrases

| Phrase | Effect |
|--------|--------|
| `skip planning`, `just do it` | Bypass mandatory planning |
| `skip tests`, `skip gates` | Bypass quality gates |
| `git is fine` | Bypass git check |
| `--force` | Bypass all blocking checks (emergency) |
| `no docs needed` | Skip documentation update |

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

---

## 🔒 Security

### Vulnerability Register

| Package | Status | Notes |
|---------|--------|-------|
| **uuid** | ✅ Fixed | Updated to patched version |
| **@modelcontextprotocol/sdk** | ⚠️ Accepted | Monitoring, no alternative |
| **protobufjs** | ⚠️ Accepted | Monitoring, no alternative |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🚀 by [Veedubin](https://github.com/Veedubin)**

*Your AI development team, on demand.*

</div>