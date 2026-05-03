# Boomerang for OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![v4.0.0](https://img.shields.io/badge/v4.0.0-Hard%20Refactor-2ecc71?style=flat-square)](https://github.com/Veedubin/opencode-boomerang/releases/tag/plugin-v4.0.0)

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

---

## 🎉 v4.0.0 Highlights

> **BREAKING: Orchestrator is now a pure decision layer** — Boomerang provides intelligent routing and context, OpenCode handles execution natively.

| Feature | Description |
|---------|-------------|
| **Pure Decision Layer** | Orchestrator analyzes requests, queries memory, selects agent, returns Context Package |
| **OpenCode Execution** | Agent execution handled natively by OpenCode — no subprocess spawning |
| **Advisory Protocol** | ProtocolAdvisor logs warnings and suggestions, never blocks execution |
| **Direct Memory** | Direct Super-Memory-TS integration via `src/memory/index.ts` |
| **6-Layer Prompts** | `buildPrompt()` composes full layered prompts for sub-agents |

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

**Find available models**: Visit [models.dev](https://models.dev/) to discover model names and IDs

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

### What Boomerang Is

**Boomerang is an orchestration plugin for OpenCode, not a standalone agent execution system.**

- **Boomerang's role**: Analyze requests, query memory, select appropriate agent, build rich Context Package
- **OpenCode's role**: Handle agent execution natively using its own agent spawning mechanism
- **Context Package**: Boomerang returns a structured package containing agent name, system prompt, context, and suggestions

### How It Works

```
User Request
      │
      ▼
┌─────────────────┐
│  Boomerang      │  ← Pure decision layer
│  Orchestrator    │     - Analyzes request
│                  │     - Queries memory
│                  │     - Selects agent
│                  │     - Builds Context Package
└─────────────────┘
      │
      ▼ (Context Package returned to OpenCode)
┌─────────────────┐
│  OpenCode       │  ← Native agent execution
│  Agent Runner   │     - Executes selected agent
│                  │     - Handles lifecycle
└─────────────────┘
```

### Orchestrator (Pure Decision Layer)

The `BoomerangOrchestrator` class provides:

| Method | Description |
|--------|-------------|
| `analyzeTask()` | Detect task type from request keywords |
| `selectAgent()` | Choose appropriate agent based on task type |
| `queryMemory()` | Search super-memory for relevant context |
| `buildContextPackage()` | Create rich context for sub-agent |
| `orchestrate()` | Main entry — returns `{agent, systemPrompt, contextPackage, suggestions}` |

### Context Package System

Boomerang passes comprehensive context to sub-agents:
- Original user request (verbatim)
- Task background and constraints
- Relevant files and code snippets
- Expected output format
- Scope boundaries and escalation targets

This ensures sub-agents have everything they need to work effectively.

### Super-Memory Hub

Super-memory is the central knowledge base:
- **Query before responding** — Orchestrator checks memory for relevant context
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
| **boomerang** | boomerang-orchestrator | Kimi K2.6 | 🎯 **Orchestrator** — Plans, coordinates, provides intelligent routing |
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

## Agent Governance (v4.0.0)

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

## 📊 Protocol Advisor (Advisory, Not Blocking)

The Boomerang Protocol is **advisory** — it suggests best practices but **never blocks execution**.

### State Machine Flow

```
IDLE → MEMORY_QUERY → SEQUENTIAL_THINK → PLAN → DELEGATE → GIT_CHECK → QUALITY_GATES → DOC_UPDATE → MEMORY_SAVE → COMPLETE
```

### Advisory Behavior

| Level | Behavior |
|-------|----------|
| **lenient** | Log suggestions, auto-fix skipped steps |
| **standard** | Log warnings and suggestions (default) |
| **strict** | Log errors and suggestions |

**Note**: Unlike previous versions, v4.0.0 **never blocks** execution regardless of strictness level. The protocol is advisory only.

### Waiver Phrases (Escape Hatches)

| Phrase | Effect |
|--------|--------|
| `skip planning`, `just do it` | Suggest bypassing planning |
| `skip tests`, `skip gates` | Suggest bypassing quality gates |
| `git is fine` | Suggest bypassing git check |
| `--force` | Suggest bypassing all checks (emergency) |
| `no docs needed` | Suggest skipping documentation update |

### How ProtocolAdvisor Works

1. **ProtocolAdvisor** logs protocol suggestions and auto-fix recommendations
2. **Never blocks** — suggestions are advisory only
3. **TaskRunner** handles prompt building only (no subprocess execution)
4. **DocTracker** tracks documentation changes via SHA-256 hash comparison

### Configuration

```typescript
// lenient: Auto-fix suggestions
// standard: Warnings and suggestions (default)
// strict: Errors and suggestions
const config = { strictness: 'standard' };
```

---

## 🧠 Memory System

Boomerang uses **Qdrant** via Super-Memory-TS for vector storage.

### Quick Start with Docker Compose

The easiest way to run Qdrant with persistent storage and auto-restart:

```bash
# Start Qdrant (persistent, auto-restart)
docker-compose up -d qdrant

# Check status
docker-compose ps

# View logs
docker-compose logs -f qdrant

# Stop (keeps data)
docker-compose stop

# Stop and remove container (data persists in ./qdrant_storage)
docker-compose down

# Full reset (removes data)
docker-compose down -v && docker-compose up -d qdrant
```

Or use the npm scripts:
```bash
npm run qdrant:start   # Start Qdrant
npm run qdrant:stop    # Stop Qdrant
npm run qdrant:logs    # View logs
npm run qdrant:status  # Check status
```

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

---

## 🏆 Key Achievements

| Achievement | Version | Description |
|-------------|---------|-------------|
| **Hard Refactor** | v4.0.0 | Orchestrator as pure decision layer, OpenCode handles execution |
| **Protocol Advisor** | v4.0.0 | Advisory-only enforcement, never blocks |
| **155 Tests** | v4.0.0 | All tests passing after refactor |
| **11 Files Deleted** | v4.0.0 | Removed dead code (AgentSpawner, TaskExecutor, ScoringRouter, etc.) |
| **18-Item Completion** | v2.3.10 | All security, feature, CI, and test work items done |
| **Agent Governance** | v2.3.2 | Code-level enforced rules, architect owns research |
| **Database Migration** | v3.0.0 | LanceDB → Qdrant for improved performance |

---

## 📁 Project Structure

```
boomerang-v2/
├── src/
│   ├── index.ts              # Plugin interface (register/activate)
│   ├── orchestrator.ts       # Pure decision layer
│   ├── memory/               # Direct Super-Memory-TS integration
│   ├── protocol/             # ProtocolAdvisor (advisory, not blocking)
│   ├── execution/            # TaskRunner (prompt builder only)
│   └── agents/               # Agent definitions
├── agents/                   # Agent markdown files
├── skills/                   # Skill definitions
├── tests/                    # Test suite (155 tests passing)
├── docs/                    # Documentation
└── package.json             # @veedubin/boomerang-v2
```

---

## 🔄 Release Pipeline

### Publishing

| Package | Registry | Trigger |
|---------|----------|---------|
| `@veedubin/boomerang-v2` | NPM | `plugin-v*.*.*` tag |
| `@veedubin/super-memory-ts` | NPM | `v*.*.*` tag |

### Version History

- **v4.0.0** — Hard refactor: Orchestrator as pure decision layer, OpenCode handles execution, advisory protocol
- **v3.2.0** — Prompt composition fix, code cleanup
- **v3.1.0** — Protocol state machine (now advisory in v4.0.0)
- **v3.0.0** — LanceDB → Qdrant migration
- **v2.0.0** — First stable with built-in memory

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🚀 by [Veedubin](https://github.com/Veedubin)**

*Your AI development team, on demand.*

</div>