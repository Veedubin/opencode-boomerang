# Architecture

System architecture for Boomerang v4.0.0 — an orchestration plugin for OpenCode.

## Overview

Boomerang v4.0.0 is a **pure decision layer** for OpenCode multi-agent orchestration:

- **Orchestrator**: Analyzes requests, queries memory, selects agents, builds Context Packages
- **OpenCode**: Handles agent execution natively
- **Super-Memory-TS**: Direct integration for semantic memory (Qdrant backend)

```
┌────────────────────────────────────────────────────────────────┐
│                         OpenCode                               │
│                    (Agent Execution)                            │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                     Boomerang Plugin                            │
│                      src/index.ts                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   register   │  │   register   │  │   register   │         │
│  │   Command    │  │    Agent     │  │    Skill     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                   Boomerang Orchestrator                        │
│                     src/orchestrator.ts                         │
│                                                                     │
│  • analyzeTask()        — Detect task type from keywords          │
│  • selectAgent()        — Choose agent based on task type        │
│  • queryMemory()        — Search super-memory for context        │
│  • buildContextPackage() — Create rich context for sub-agent      │
│  • orchestrate()         — Returns {agent, systemPrompt,         │
│                              contextPackage, suggestions}        │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                      Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Qdrant     │  │  Super-      │  │    BGE       │       │
│  │  (Vectors)    │  │  Memory-TS   │  │  (Embeddings)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

## What Boomerang IS NOT

> **Important**: Previous versions of Boomerang claimed features that were never implemented.

| Claimed (Old) | Reality (v4.0.0) |
|---------------|------------------|
| Real agent execution via subprocess spawn | **Deleted** — AgentSpawner was fake simulation |
| Blocking protocol enforcement | **Advisory only** — ProtocolAdvisor never blocks |
| Context monitoring with compaction | **Deleted** — ContextMonitor used naive 4chars/token heuristic |
| Scoring router with metrics-based routing | **Deleted** — ScoringRouter queried wrong event type |
| MCP server for memory operations | **Deprecated** — Direct integration instead |

## Core Components

### Plugin Interface (`src/index.ts`)

Entry point for OpenCode plugin integration.

**Responsibilities:**
- Register commands (`boomerang`, `chat`, `index`)
- Register agents from `agents/` directory
- Register skills from `skills/` directory
- Initialize memory integration
- Route CLI commands to appropriate handlers

### Orchestrator (`src/orchestrator.ts`)

**Pure decision layer** — no agent execution.

**Key Methods:**
| Method | Description |
|--------|-------------|
| `analyzeTask(request: string): TaskType` | Detect task type from keywords |
| `selectAgent(taskType: TaskType): AgentDefinition` | Choose agent based on task type |
| `queryMemory(query: string): Promise<MemoryResult[]>` | Search super-memory |
| `buildContextPackage(task: Task, agent: AgentDefinition): ContextPackage` | Create rich context |
| `orchestrate(request: string): Promise<OrchestrationResult>` | Main entry point |

**Returns:**
```typescript
interface OrchestrationResult {
  agent: string;           // Agent name (e.g., "boomerang-coder")
  systemPrompt: string;    // Full layered prompt
  contextPackage: ContextPackage;  // Structured context
  suggestions: string[];    // Protocol suggestions
}
```

**Task Types:**
| Type | Keywords | Default Agent |
|------|----------|---------------|
| `explore` | explore, find, search | boomerang-explorer |
| `code` | code, implement, create | boomerang-coder |
| `test` | test, verify, check | boomerang-tester |
| `review` | review, analyze, architect | boomerang-architect |
| `write` | doc, readme, write | boomerang-writer |
| `git` | git, commit, push | boomerang-git |
| `general` | default | boomerang |

### ProtocolAdvisor (`src/protocol/enforcer.ts`)

**Advisory only** — logs suggestions and warnings, never blocks execution.

**Key Behavior:**
- Logs protocol suggestions at each step
- Suggests auto-fix for skipped steps
- Never blocks transitions regardless of strictness level

**State Flow:**
```
IDLE → MEMORY_QUERY → SEQUENTIAL_THINK → PLAN → DELEGATE → GIT_CHECK → QUALITY_GATES → DOC_UPDATE → MEMORY_SAVE → COMPLETE
```

### TaskRunner (`src/execution/task-runner.ts`)

**Prompt builder only** — no subprocess execution.

**Responsibilities:**
- Load agent definitions from `agents/*.md`
- Load skill instructions from `skills/*/SKILL.md`
- Compose 6-layer prompts via `buildPrompt()`:
  1. Agent systemPrompt (identity)
  2. Agent prompt (rules, style guides, escalation triggers, project context)
  3. Skill instructions (auto-loaded from `.opencode/skills/{agent}/SKILL.md`)
  4. Rich Context Package (structured ### headings)
  5. Task description
  6. Execution instructions

### Memory Integration (`src/memory/index.ts`)

**Direct Super-Memory-TS integration** — no MCP transport.

**Features:**
- Direct function calls (no serialization overhead)
- QueryMemories, addMemory, searchProject, indexProject
- Qdrant backend with fp16 embeddings
- Per-project isolation via `BOOMERANG_PROJECT_ID`

---

## Data Flow

### Request → Decision → Context Package

```
1. User Request
        │
        ▼
2. BoomerangOrchestrator.analyzeTask()
        │  └─→ Keyword detection
        ▼
3. BoomerangOrchestrator.selectAgent()
        │  └─→ Task type → Agent mapping
        ▼
4. BoomerangOrchestrator.queryMemory()
        │  └─→ Super-Memory-TS queryMemories()
        │         └─→ Qdrant vector search
        ▼
5. BoomerangOrchestrator.buildContextPackage()
        │  • Original request
        │  • Task background
        │  • Relevant files
        │  • Memory context
        │  • Scope boundaries
        ▼
6. Return OrchestrationResult
        │
        ▼
7. OpenCode executes selected agent with context
```

---

## Deleted Components

The following were **deleted in v4.0.0 hard refactor**:

| File | Reason |
|------|--------|
| `src/execution/agent-spawner.ts` | Fake simulation, not real execution |
| `src/task-executor.ts` | Duplicate execution logic |
| `src/routing/scoring-router.ts` | Queried wrong metrics event type |
| `src/context/monitor.ts` | Naive 4chars/token heuristic, never read actual tokens |
| `src/context/compactor.ts` | No real compaction implementation |
| `src/middleware/pipeline.ts` | Never integrated into execution path |
| `src/protocol/tracker.ts` | Deprecated |
| `src/execution/sequential-thinker.ts` | `globalThis.mcp` never true in Node.js |
| `src/server.ts` | Deprecated MCP server |
| `src/memory-service.ts` | Replaced by direct memory integration |
| `src/utils/frontmatter.ts` | Inline parsing in asset-loader |

---

## Memory System (Qdrant)

### Vector Storage

**Database:** Qdrant (cloud-native vector database)

**Schema:**
```typescript
interface MemoryEntry {
  id: string;           // UUID
  text: string;         // Raw text (max 8192 chars)
  vector: Float32[];    // 1024-dim embedding (BGE-Large)
  sourceType: SourceType;
  sourcePath: string;
  timestamp: number;
  contentHash: string;  // SHA-256 of content
  metadataJson: string;
  sessionId: string;
  projectId: string;    // For isolation
}
```

### Search Strategy

**TIERED (default):**
1. Vector search first (MiniLM for speed, BGE fallback)
2. Apply threshold filter
3. Re-rank with text similarity
4. Return topK results

**VECTOR_ONLY:**
1. Pure vector similarity search
2. Return topK results

**TEXT_ONLY:**
1. Keyword search
2. Return topK results

---

## Agent System

### Loading

Agents are loaded from `agents/*.md` files via `asset-loader.ts`:

```typescript
// src/asset-loader.ts
function loadAgents(): AgentDefinition[] {
  const files = readdirSync('agents/').filter(f => f.endsWith('.md'));
  // Parse frontmatter and extract system prompt
}
```

### Structure

```markdown
---
description: Agent description
model: minimax/MiniMax-M2.7
skills: [skill1, skill2]
---

# System prompt content
Agent instructions...
```

### Skills

Skills follow the same pattern in `skills/<name>/SKILL.md`:

```markdown
---
name: skill-name
description: Skill description
---

# Instructions
Skill-specific instructions...
```

---

## Error Handling

### Error Types (`src/utils/errors.ts`)

```typescript
class MemoryError extends Error { }
class ValidationError extends Error { }
class NotFoundError extends Error { }
class ConnectionError extends Error { }
```

### Recovery

- **Memory**: Graceful degradation if Qdrant unavailable (returns empty results)
- **Orchestrator**: Returns partial results with error in suggestions
- **ProtocolAdvisor**: Logs errors but never blocks

---

## Configuration

### Default Values

```typescript
const DEFAULT_CONFIG = {
  memory: {
    qdrantUrl: 'http://localhost:6333',
    projectId: 'default',
  },
  protocol: {
    strictness: 'standard',  // Advisory only in v4.0.0
  },
  agents: {
    defaultTier: 'secondary',
  },
};
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `BOOMERANG_PROJECT_ID` | `default` | Project isolation ID |
| `SUPER_MEMORY_EAGER_LOAD` | `false` | Pre-load embedding model |

---

## Architecture Summary

| Aspect | Implementation |
|--------|----------------|
| **Orchestrator** | Pure decision layer (src/orchestrator.ts) |
| **Agent Execution** | OpenCode native (not Boomerang) |
| **Protocol** | Advisory via ProtocolAdvisor (never blocks) |
| **Memory** | Direct Super-Memory-TS via src/memory/index.ts |
| **Prompt Building** | 6-layer buildPrompt() in TaskRunner |
| **Metrics** | JSONL file collection (src/metrics/collector.ts) |
| **Doc Tracking** | SHA-256 comparison via DocTracker |

---

## Version History

| Version | Changes |
|---------|---------|
| v4.0.0 | Hard refactor — orchestrator as pure decision layer, OpenCode handles execution, advisory protocol |
| v3.2.0 | Prompt composition fix |
| v3.1.0 | Protocol state machine (now advisory) |
| v3.0.0 | LanceDB → Qdrant migration |
| v2.0.0 | First stable with built-in memory |