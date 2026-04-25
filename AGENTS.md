# Boomerang Agent Roster

## Core Agents

| Agent | Skill | Model | Role |
|-------|-------|-------|------|
| **boomerang** | boomerang-orchestrator | Kimi K2.6 | 🎯 **Orchestrator** — Plans, coordinates, enforces protocol |
| **boomerang-coder** | boomerang-coder | MiniMax M2.7 | 💻 **Fast code generation** — Write and modify code efficiently |
| **boomerang-architect** | boomerang-architect | Kimi K2.6 | 🏗️ **Design decisions** — Trade-off analysis and architecture |
| **boomerang-explorer** | boomerang-explorer | MiniMax M2.7 | 🔍 **Codebase exploration** — Find files, search patterns, understand structure |
| **boomerang-tester** | boomerang-tester | MiniMax M2.7 | 🧪 **Testing specialist** — Unit/integration tests, verification |
| **boomerang-linter** | boomerang-linter | MiniMax M2.7 | ✅ **Quality enforcement** — Lint, format, style consistency |
| **boomerang-git** | boomerang-git | MiniMax M2.7 | 📦 **Version control** — Commits, branches, history discipline |
| **boomerang-writer** | boomerang-writer | Kimi K2.6 | 📝 **Documentation** — Markdown writing and documentation |
| **boomerang-scraper** | boomerang-scraper | MiniMax M2.7 | 🌐 **Web scraping** — Research and information gathering |
| **researcher** | researcher | MiniMax M2.7 | 🌐 **Web research** — Search, fetch, and synthesize online information |

| Skill | Purpose | Model |
|-------|---------|-------|
| **boomerang-init** | Initialize and personalize agents for a project | Kimi K2.6 |
| **boomerang-handoff** | Wrap-up session. Updates docs, saves context | Kimi K2.6 |

## Agent Selection Guide

| Task Type | → Primary Agent | Model |
|-----------|------------------|-------|
| Complex planning / orchestration | `boomerang` | Kimi K2.6 |
| Architecture / design decisions | `boomerang-architect` | Kimi K2.6 |
| Documentation writing | `boomerang-writer` | Kimi K2.6 |
| Session initialization | `boomerang-init` | Kimi K2.6 |
| Session wrap-up / handoff | `boomerang-handoff` | Kimi K2.6 |
| Fast code generation / bug fixes | `boomerang-coder` | MiniMax M2.7 |
| Code exploration / finding files | `boomerang-explorer` | MiniMax M2.7 |
| Writing / running tests | `boomerang-tester` | MiniMax M2.7 |
| Linting / formatting | `boomerang-linter` | MiniMax M2.7 |
| Git operations | `boomerang-git` | MiniMax M2.7 |
| Web research / scraping | `boomerang-scraper` | MiniMax M2.7 |

## MANDATORY Super-Memory Protocol

> **⚠️ IMPORTANT**: All sub-agents are required to follow the super-memory protocol. Prompts have been updated to make this MANDATORY, not optional.

### Built-in Integration Architecture (v2.1.4+)

Boomerang v2 uses **built-in direct integration** with Super-Memory-TS core modules.

| Integration | Description |
|-------------|-------------|
| **Built-in (Default)** | Direct import of Super-Memory-TS core modules — zero overhead |
| **MCP (External)** | Standalone MCP server for non-boomerang users |

#### How Built-in Memory Works

- Boomerang imports `MemorySystem` directly from `src/memory/index.js`
- `MemoryService` wraps core modules with a clean API
- All memory operations are direct function calls (no serialization)
- Project indexing runs via `ProjectIndexer` directly
- The MCP server (`src/server.ts`) is ONLY for external users

#### Memory Operations (Direct)

All agents MUST:
1. **Query memory FIRST** — `memoryService.queryMemories()` before work
2. **Use sequential-thinking** — For complex tasks
3. **Save results** — `memoryService.addMemory()` when complete

### Legacy: MCP-Only Architecture (v2.0.0 - REPLACED)

> **⚠️ DEPRECATED**: The MCP-only architecture (v2.0.0) has been replaced by built-in integration. The MCP server is retained only for external users who don't use Boomerang.

- Boomerang v2.1.4+ uses direct imports from `src/memory/` instead of MCP tool calls
- MCP tool names below are only for external users connecting to the standalone server:
  - `super-memory_query_memories` - Search memories
  - `super-memory_add_memory` - Save to memory
  - `super-memory_search_project` - Search indexed project files
  - `super-memory_index_project` - Index project files

### Memory Operations

All agents MUST:
1. **Query super-memory FIRST** - Before doing ANY work, call `super-memory_query_memories` with the task description
2. **Use sequential-thinking** - Call `sequential-thinking_sequentialthinking` to analyze complex tasks
3. **Save results to super-memory** - Call `super-memory_add_memory` with a summary when complete

### Tiered Memory Architecture

This project uses a tiered memory architecture with two modes:
- **Fast Reply** (TIERED): Quick MiniLM search with BGE fallback for speed
- **Archivist** (PARALLEL): Dual-tier search with RRF fusion for maximum recall

#### When Saving:
- **Routine work** (logs, quick fixes, explorations): Use standard `super-memory_add_memory`
- **High-value work** (architectural decisions, session summaries, verified successes): Use `super-memory_add_memory` with a descriptive `project` tag in metadata

#### When Searching:
- Default searches use the configured strategy automatically
- For explicit control: `super-memory_query_memories` with `strategy` parameter (`tiered`, `vector_only`, or `text_only`)

## Mandatory Metrics Collection (v1.0.0)

> **⚠️ IMPORTANT**: All agents must participate in metrics collection for routing optimization.

### Metrics Collected Per Task

| Metric | Description |
|--------|-------------|
| `task_type` | Category of task (code_generation, testing, etc.) |
| `agent_id` | Which agent handled the task |
| `duration_ms` | Task execution time in milliseconds |
| `success` | Whether task completed successfully |
| `tokens_used` | LLM token consumption |
| `context_used_pct` | Percentage of context window used |

### Metrics Storage

Metrics are stored in `memory_data/metrics/` (per-project isolation).

### How It Works

1. Orchestrator wraps agent calls with timing/counting hooks
2. After task completion, metrics are stored in local LanceDB
3. Routing optimizer uses aggregated metrics for future task assignment
4. Minimum 5 samples required before metrics affect routing

### Performance Targets

| Metric | Target |
|--------|--------|
| Query latency | <10ms p50 |
| Embedding time | <100ms per query |
| Memory usage | <500MB total |
| Indexing throughput | >100 files/min |

## Project-Specific Context

This is the Boomerang v2.0.0 multi-agent orchestration system for OpenCode.