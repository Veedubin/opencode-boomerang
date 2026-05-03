# 🚀 Boomerang for OpenCode

> **This package is the OpenCode plugin. For the standalone MCP server, see `@veedubin/super-memory-ts`.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)
[![v4.0.0](https://img.shields.io/badge/v4.0.0-Advisory%20Protocol-2ecc71?style=flat-square)](https://github.com/Veedubin/opencode-boomerang/releases/tag/plugin-v4.0.0)

*Intelligent routing and context building for OpenCode — because great software is a team sport.*

---

## 🎉 v4.0.0 Highlights

> **Pure Decision Layer** — The orchestrator analyzes requests and builds Context Packages. OpenCode handles agent execution natively.

| Feature | Description |
|---------|-------------|
| **Orchestrator (Decision Layer)** | Analyzes request, queries memory, detects task type, returns `{agent, systemPrompt, contextPackage, suggestions}` |
| **OpenCode Execution** | Native agent execution — no subprocess spawning |
| **Protocol Advisor** | Logs suggestions, never blocks execution |
| **6-Layer Prompt Composition** | TaskRunner builds rich Context Packages |
| **Keyword Routing** | Simple efficient routing (scoring router deleted) |
| **Direct Memory Integration** | Zero-overhead access to Super-Memory-TS core |

### What v4.0.0 Does NOT Do

- ❌ No subprocess spawning (OpenCode handles execution)
- ❌ No blocking protocol enforcement (advisory only)
- ❌ No context monitoring/compaction
- ❌ No scoring router
- ❌ No middleware pipeline
- ❌ No MCP server in plugin (deprecated)
- ❌ No LanceDB (Qdrant only)

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
|---------|-----------|
| `bun run build` | Build TypeScript to `dist/` |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint |
| `npx vitest run` | Run test suite |

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

## 🏗️ Architecture

### Orchestrator = Pure Decision Layer

The orchestrator provides **intelligent routing and context building** — it does not execute agents directly.

**Orchestrator Does:**
- Analyze request and detect task type
- Query super-memory for relevant context
- Select appropriate agent based on task keywords
- Build rich Context Package with all necessary information
- Return `{agent, systemPrompt, contextPackage, suggestions}` to OpenCode

**Orchestrator Delegates:**
- Agent execution → OpenCode (native)
- Multi-file changes → sub-agents
- Complex implementation → boomerang-coder
- Architecture decisions → boomerang-architect

### Decision Flow

```
User Request → Orchestrator → Memory Query → Task Analysis → Agent Selection → Context Package → OpenCode Execution
```

### Context Package (6-Layer Composition)

TaskRunner builds comprehensive Context Packages:

1. **System Prompt** — Agent role and behavior rules
2. **Skill Instructions** — Domain-specific guidance
3. **Original Request** — User's verbatim input
4. **Task Background** — Context and constraints
5. **Relevant Files** — Code snippets and file paths
6. **Scope Boundaries** — IN vs OUT of scope, error handling

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
| **Primary Tier** | Design, research, orchestration | architect, writer, handoff, init |
| **Secondary Tier** | Implementation, tools | coder, explorer, tester, linter, git, scraper, researcher, mcp-specialist, release |

**NO SPAWNING** — Sub-agents do not spawn child agents.

---

## 💡 Protocol Advisory (Not Blocking)

The Boomerang Protocol is **advisory only** — it suggests best practices but never blocks execution.

### Advisory State Machine

```
IDLE → MEMORY_QUERY → SEQUENTIAL_THINK → PLAN → DELEGATE → GIT_CHECK → QUALITY_GATES → DOC_UPDATE → MEMORY_SAVE → COMPLETE
```

### 8-Step Advisory Protocol

| Step | Action | Description |
|------|--------|-------------|
| 1. Memory Query | Suggest | Query super-memory before work |
| 2. Sequential Thinking | Suggest | Think through complex tasks |
| 3. Plan | Suggest | Create implementation plan |
| 4. Delegate | OpenCode handles | OpenCode executes selected agent |
| 5. Git Check | Suggest | Verify working tree state |
| 6. Quality Gates | Suggest | Run lint/typecheck/test |
| 7. Doc Update | Track only | Log documentation changes |
| 8. Memory Save | Suggest | Save to super-memory |

### Advisory Levels

| Level | Behavior |
|-------|----------|
| **lenient** | Log suggestions, auto-fix logged |
| **standard** | Log warnings and suggestions (default) |
| **strict** | Log errors and suggestions |

**Important**: v4.0.0 **never blocks** execution regardless of level.

### Planning Enforcement

Planning is **mandatory** for build/create/implement tasks unless user explicitly waives:
- `skip planning`
- `just do it`
- `no plan needed`

Simple tasks (handoff, status checks, single-file docs) may skip planning.

---

## 🧠 Built-in Memory Integration

Boomerang uses **direct module imports** for zero-overhead memory access:

```typescript
import { MemorySystem } from './memory/index.js';
```

### Memory Operations (Direct)

| Operation | Method | Description |
|-----------|--------|-------------|
| Query | `memorySystem.queryMemories()` | Semantic search across sessions |
| Save | `memorySystem.addMemory()` | Store decisions and learnings |
| Project Search | `memorySystem.searchProject()` | Search indexed project files |
| Index | `memorySystem.indexProject()` | Trigger project re-indexing |

### Tiered Memory Architecture

| Mode | Description |
|------|-------------|
| **Fast Reply (TIERED)** | Quick MiniLM search with BGE fallback for speed |
| **Archivist (PARALLEL)** | Dual-tier search with RRF fusion for maximum recall |

---

## 📦 Plugin API Usage

### Basic Integration

```typescript
import { createBoomerangPlugin } from '@veedubin/boomerang-v2';

const plugin = createBoomerangPlugin({
  primaryModel: 'kimi-for-coding/k2p6',
  secondaryModel: 'minimax/MiniMax-M2.7',
});

// Register in OpenCode
plugin.register(opencode);
```

### Orchestrator Response

The orchestrator returns a structured response:

```typescript
{
  agent: 'boomerang-coder',       // Selected agent
  systemPrompt: 'You are a...',   // Agent system prompt
  contextPackage: {              // Rich context for the task
    originalRequest: 'Write a function...',
    taskBackground: 'User needs...',
    relevantFiles: ['src/utils.ts'],
    codeSnippets: ['function util()...'],
    scopeBoundaries: { in: [...], out: [...] },
    errorHandling: 'If X fails...'
  },
  suggestions: ['Query memory first', 'Run tests after']
}
```

### Protocol Advisor

```typescript
import { createProtocolAdvisor } from '@veedubin/boomerang-v2';

const advisor = createProtocolAdvisor({
  strictness: 'standard',  // lenient | standard | strict
});

advisor.onSuggestion((suggestion) => {
  console.log(`💡 ${suggestion.message}`);
});

advisor.onWarning((warning) => {
  console.warn(`⚠️ ${warning.message}`);
});
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

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🚀 by [Veedubin](https://github.com/Veedubin)**

*Your AI development team, on demand.*

</div>