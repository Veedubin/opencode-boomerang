# Boomerang Agent Roster

## Core Agents

> **Note**: Models are configurable. Use `install-agents.js --primary=<model> --secondary=<model>` to customize.

| Agent | Skill | Default Model | Role |
|-------|-------|-------|------|
| **boomerang** | boomerang-orchestrator | Kimi K2.6 | 🎯 **Orchestrator** — Plans, coordinates, provides intelligent routing |
| **boomerang-coder** | boomerang-coder | MiniMax M2.7 | 💻 **Fast code generation** — Write and modify code efficiently |
| **boomerang-architect** | boomerang-architect | Kimi K2.6 | 🏗️ **Design decisions** — Trade-off analysis and architecture |
| **boomerang-explorer** | boomerang-explorer | MiniMax M2.7 | 🔍 **Codebase exploration** — Find files by name/glob |
| **boomerang-tester** | boomerang-tester | MiniMax M2.7 | 🧪 **Testing specialist** — Unit/integration tests, verification |
| **boomerang-linter** | boomerang-linter | MiniMax M2.7 | ✅ **Quality enforcement** — Lint, format, style consistency |
| **boomerang-git** | boomerang-git | MiniMax M2.7 | 📦 **Version control** — Commits, branches, history discipline |
| **boomerang-writer** | boomerang-writer | Kimi K2.6 | 📝 **Documentation** — Markdown writing and documentation |
| **boomerang-scraper** | boomerang-scraper | MiniMax M2.7 | 🌐 **Web scraping** — Research and information gathering |
| **boomerang-release** | boomerang-release | MiniMax M2.7 | 🚀 **Release automation** — Version bump, changelog, publish |
| **researcher** | researcher | MiniMax M2.7 | 🌐 **Web research** — Search, fetch, and synthesize online information |
| **mcp-specialist** | mcp-specialist | MiniMax M2.7 | 🔌 **MCP Protocol** — Tool design, server debug |

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
| MCP tool design / server debug | `mcp-specialist` | MiniMax M2.7 |
| Release automation | `boomerang-release` | MiniMax M2.7 |

### Orchestrator Permissions (v4.0.0)

The orchestrator provides **intelligent routing and context building** — it does not execute agents directly.

**Orchestrator Does:**
- Analyze request and detect task type
- Query super-memory for relevant context
- Select appropriate agent based on task
- Build rich Context Package with all necessary information
- Return `{agent, systemPrompt, contextPackage, suggestions}` to OpenCode

**Orchestrator Delegates:**
- Agent execution → OpenCode (native)
- Multi-file changes → sub-agents
- Complex implementation → boomerang-coder
- Architecture decisions → boomerang-architect

**Decision Threshold:**
```
Task Size ≤ 1 file AND ≤ 20 lines AND deterministic
    → Orchestrator handles directly

Task Size > 1 file OR > 20 lines OR needs analysis
    → Delegate to appropriate sub-agent
```

### Architect Reasoning Level

The `boomerang-architect` agent uses **highest reasoning level** for Kimi K2.6 when creating implementation plans. The plan is handed back to the orchestrator as a "ready-to-run game plan" for dispatching coders, testers, etc.

## Protocol (Advisory, Not Blocking)

All agents are encouraged to follow the **8-Step Boomerang Protocol**, but enforcement is **advisory only**.

### 8-Step Protocol (Encouraged, Not Enforced)

1. **Query Memory** — `super-memory_query_memories` FIRST
2. **Think** — `sequential-thinking_sequentialthinking` for complex tasks
3. **Plan** — Create/refine implementation plan (MANDATORY unless user explicitly waives)
4. **Delegate** — OpenCode executes selected agent with Context Package
5. **Git Check** — Verify working tree state before code changes
6. **Quality Gates** — Lint → Typecheck → Test
7. **Update Docs & Todos** — Update TASKS.md, todo list, AGENTS.md as needed
8. **Save Memory** — `super-memory_add_memory` with project tag

### Planning Enforcement

Planning is MANDATORY unless user explicitly waives with phrases like:
- "skip planning"
- "just do it"
- "/boomerang-handoff"
- "do a handoff"
- "no plan needed"

Simple tasks (handoff, status checks, single-file docs) may skip planning.
Build/create/implement tasks ALWAYS require planning.

### Context Passing

The orchestrator builds a complete Context Package with:
1. Original User Request (verbatim)
2. Task Background
3. Relevant Files
4. Code Snippets
5. Previous Decisions & Constraints
6. Expected Output Format
7. Scope Boundaries (IN vs OUT of scope)
8. Error Handling

### Super-Memory Hub
- Query super-memory BEFORE answering user
- Save to super-memory AFTER answering user
- Pass context DIRECTLY to sub-agents (don't tell them to query memory)
- Sub-agents save detailed work to memory, return thin summaries

## Documentation Maintenance (Encouraged)

After EVERY session interaction, consider updating:

1. **TASKS.md** — Mark done, add new, remove outdated
2. **Todo List** — Mark completed, remove old, add new
3. **AGENTS.md** — Update if agent changes made
4. **README.md** — Update if user-facing changes
5. **HANDOFF.md** — Update at session end

> **Note**: Unlike previous versions, documentation updates are **encouraged but not enforced** at handoff.

### Built-in Integration Architecture (v4.0.0)

Boomerang v4 uses **direct integration** with Super-Memory-TS core modules — no MCP transport overhead.

| Integration | Description |
|-------------|-------------|
| **Built-in (Default)** | Direct import of Super-Memory-TS core modules — zero overhead |
| **MCP (External)** | Standalone MCP server for non-boomerang users |

#### How Built-in Memory Works

- Boomerang imports `MemorySystem` directly from `src/memory/index.js`
- `MemoryService` wraps core modules with a clean API
- All memory operations are direct function calls (no serialization)
- The MCP server (`src/server.ts`) is deprecated — use built-in integration

### Memory Operations (Direct)

All agents SHOULD:
1. **Query memory FIRST** — `memoryService.queryMemories()` before work
2. **Use sequential-thinking** — For complex tasks
3. **Save results** — `memoryService.addMemory()` when complete

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

## Project-Specific Context

This is Boomerang v4.0.0 — an orchestration plugin for OpenCode that provides intelligent routing and context, while OpenCode handles agent execution natively.

## Agent Governance Rules (v4.0.0)

> **⚠️ CODE-LEVEL ENFORCED** — These rules are not optional guidelines.

### Research Ownership
- **boomerang-architect** owns ALL research tasks (web searches, code analysis, documentation review)
- boomerang-explorer is **file-finding only** - no pattern analysis or code research
- **super-memory_search_project** is the primary research tool for codebase investigation

### Orchestrator Delegation Rules
1. Research tasks → `boomerang-architect` (NOT explorer)
2. File finding → `boomerang-explorer` (only for glob/find operations)
3. Code implementation → `boomerang-coder`
4. Never delegate research to explorer - architect handles it

### Agent Scope Boundaries

| Agent | Scope |
|-------|-------|
| boomerang-explorer | Find files by name/glob ONLY |
| boomerang-architect | Design + Research + Code analysis |
| boomerang-coder | Code implementation |
| boomerang-tester | Test writing |
| boomerang-linter | Quality enforcement |

### Why This Matters
- Prevents duplicate work (explorer finds file, architect analyzes)
- Ensures proper context for design decisions
- Uses built-in super-memory search for efficient research

## Protocol Advisor v4.0.0

> **BREAKING CHANGE**: The Boomerang Protocol is now **ADVISORY ONLY** — it suggests best practices but never blocks execution.

### Architecture: Advisory State Machine

The protocol is implemented as an **advisory state machine**:

```
IDLE → MEMORY_QUERY → SEQUENTIAL_THINK → PLAN → DELEGATE → GIT_CHECK → QUALITY_GATES → DOC_UPDATE → MEMORY_SAVE → COMPLETE
```

| Component | Purpose |
|-----------|---------|
| **ProtocolStateMachine** | Tracks state transitions for logging |
| **ProtocolAdvisor** | Logs suggestions and warnings, never blocks |
| **TaskRunner** | Prompt builder only (no subprocess execution) |
| **DocTracker** | Tracks documentation changes via SHA-256 hash comparison |

### Strictness Levels (Advisory)

| Level | Behavior |
|-------|----------|
| **lenient** | Log suggestions, auto-fix logged |
| **standard** | Log warnings and suggestions (default) |
| **strict** | Log errors and suggestions |

**Important**: Unlike previous versions, v4.0.0 **never blocks** execution regardless of strictness level.

### 8-Step Advisory Protocol

1. **MEMORY_QUERY** — Suggest `super-memory_query_memories` if not already called
2. **SEQUENTIAL_THINK** — Suggest `sequential-thinking_sequentialthinking` for complex tasks
3. **PLAN** — Suggest architect review for build tasks
4. **DELEGATE** — OpenCode handles agent execution
5. **GIT_CHECK** — Suggest verifying working tree state
6. **QUALITY_GATES** — Suggest running lint/typecheck/test
7. **DOC_UPDATE** — Track via DocTracker, suggest at handoff
8. **MEMORY_SAVE** — Auto-save suggestion if skipped

### Suggestion Matrix

| Step | Suggestion | Waiver Phrase |
|------|------------|---------------|
| 1. Memory Query | Query memory first | None needed (advisory) |
| 2. Sequential Thinking | Think through complex tasks | None needed (advisory) |
| 3. Planning | Get architect review | "skip planning", "just do it" |
| 4. Delegate | OpenCode executes | None |
| 5. Git Check | Check working tree | "git is fine" |
| 6. Quality Gates | Run quality gates | "skip tests", "skip gates" |
| 7. Doc Update | Update documentation | "no docs needed" |
| 8. Memory Save | Save to memory | None (auto-suggested) |

### Waiver Phrases (Escape Hatches)

| Phrase | Effect |
|--------|--------|
| `skip planning` | Suggest bypassing planning |
| `just do it` | Suggest bypassing planning |
| `no plan needed` | Suggest bypassing planning |
| `skip tests` | Suggest bypassing quality gates |
| `skip gates` | Suggest bypassing quality gates |
| `git is fine` | Suggest bypassing git check |
| `--force` | Suggest bypassing all checks (emergency) |
| `no docs needed` | Suggest skipping documentation update |

### Implementation Files

| File | Purpose |
|------|---------|
| `src/protocol/state-machine.ts` | ProtocolStateMachine class (state tracking) |
| `src/protocol/checkpoint.ts` | CheckpointRegistry (logging only) |
| `src/protocol/types.ts` | State, event, config types |
| `src/protocol/events.ts` | Event emitter for state transitions |
| `src/protocol/config.ts` | Strictness levels, waiver phrases |
| `src/protocol/enforcer.ts` | ProtocolAdvisor (advisory only, never blocks) |
| `src/execution/task-runner.ts` | TaskRunner class (prompt builder only) |
| `src/execution/doc-tracker.ts` | DocTracker for SHA-256 tracking |

---

## Review Notes

- **2026-05-03**: v4.0.0 HARD REFACTOR COMPLETE — Orchestrator is pure decision layer, OpenCode handles execution, protocol is advisory only. 155/155 tests passing. Deleted 11 dead files (AgentSpawner, TaskExecutor, ScoringRouter, ContextMonitor, Compactor, MiddlewarePipeline, ProtocolTracker, SequentialThinker, server.ts, memory-service, frontmatter).
- **2026-05-01**: v3.2.0 RELEASED — buildPrompt() fix: sub-agents now receive full layered prompts (systemPrompt + agent rules + skill instructions + Context Package + task + instructions). Skill auto-loading from `.opencode/skills/`. 14 new tests.
- **2026-05-01**: v3.2.0 (pending release) — Code audit & cleanup session. Removed uuid dependency (replaced with crypto.randomUUID()). Extracted shared utilities to src/utils/frontmatter.ts and src/utils/similarity.ts. Consolidated AgentDefinition into protocol/types.ts. Migrated protocolTracker → ProtocolStateMachine. Deprecated server.ts. Fixed unsafe casts and type issues. Quality gates: 212/212 tests passing.
- **2026-04-30**: v3.1.0 BREAKING — Code-enforced protocol via state machine. All 8 phases complete. 205 tests passing. (Note: protocol is now advisory in v4.0.0)