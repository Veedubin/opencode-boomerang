# Architecture

System architecture for Boomerang v2 multi-agent orchestration system.

## Overview

Boomerang v2 is a TypeScript-based multi-agent orchestration system that combines:

- **Vector memory** for semantic search
- **Task planning** with dependency graphs
- **Project indexing** for code understanding
- **MCP integration** for tool calls

```
┌────────────────────────────────────────────────────────────────┐
│                         CLI / TUI                               │
│                    (boomerang command)                         │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     Plugin Interface                           │
│                      src/index.ts                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   register   │  │   register   │  │   register   │         │
│  │   Command    │  │    Agent     │  │    Skill     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Orchestrator   │ │  MemoryClient   │ │ ProjectIndexer  │
│                │ │                 │ │                 │
│ • Task planning│ │ • MCP client    │ │ • File watching │
│ • Dependency   │ │ • Auto-reconnect│ │ • Queue system  │
│   graphs       │ │ • Memory ops    │ │ • Hash detection│
│ • Agent routing│ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          │                   ▼                   │
          │          ┌─────────────────┐         │
          │          │  MCP Server     │         │
          │          │  src/server.ts  │         │
          │          └─────────────────┘         │
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   LanceDB    │  │    Fuse.js   │  │ Transformers │       │
│  │  (Vectors)   │  │   (Text)     │  │ (Embeddings) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

## Components

### Plugin Interface (`src/index.ts`)

Entry point for OpenCode plugin integration.

**Responsibilities:**
- Register commands (`boomerang`, `chat`, `index`)
- Register agents from `agents/` directory
- Register skills from `skills/` directory
- Initialize memory client
- Route CLI commands to appropriate handlers

### Orchestrator (`src/orchestrator.ts`)

Task planning and dependency graph management.

**Key Features:**
- Parse user requests into subtasks
- Detect task type from keywords
- Assign agents based on task type
- Build and validate dependency graphs
- Cycle detection using DFS
- Graph optimization (transitive edge removal)
- Topological sort for execution order

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

### MemoryClient (`src/memory-client.ts`)

MCP SDK client for memory operations.

**Features:**
- Stdio transport to MCP server
- Auto-reconnect with exponential backoff
- Tool calls: `query_memories`, `add_memory`, `search_project`, `index_project`

### ProjectIndexer (`src/project-index/indexer.ts`)

Background file indexing with queue system.

**Components:**
- **File Watcher** (`watcher.ts`) - `chokidar`-based file monitoring
- **Chunker** (`chunker.ts`) - Split files with line metadata
- **Queue System** - Concurrent processing with limits
- **Hash Detection** - Skip unchanged files via SHA-256

**Processing Flow:**
```
File Event → Queue → Check Hash → [Changed?] → Chunk → Embed → Store
                    ↓
              Remove existing
              chunks for file
```

### MCP Server (`src/server.ts`)

Server implementing MCP tools for memory operations.

**Tools:**
| Tool | Handler | Description |
|------|---------|-------------|
| `query_memories` | `handleQueryMemories` | Vector + text search |
| `add_memory` | `handleAddMemory` | Store new memory |
| `search_project` | `handleSearchProject` | Search indexed files |
| `index_project` | `handleIndexProject` | Start indexing |

### Memory System (`src/memory/`)

**LanceDB** (`database.ts`) - Connection pooling for vector storage

**MemorySearch** (`search.ts`) - Hybrid search combining:
- **Vector search** - HNSW index for semantic similarity
- **Text search** - Fuse.js for keyword matching
- **Tiered search** - Vector-first, text fallback

**Operations** (`operations.ts`) - CRUD operations for memory entries

### Model Manager (`src/model/`)

Embedding model management using `@xenova/transformers`.

**Default Model:** `BAAI/bge-large-en-v1.5`
- **Dimensions:** 1024
- **Normalized:** Yes

---

## Data Flow

### Request → Memory Query → Task Planning → Execution

```
1. User Request
       │
       ▼
2. Orchestrator.queryContext()
       │  └─→ MemoryClient.queryMemories()
       │         └─→ MCP Server → LanceDB (HNSW)
       ▼
3. Orchestrator.planTask()
       │  • Parse request into subtasks
       │  • Detect task types
       │  • Assign agents
       │  • Build dependency graph
       ▼
4. Task Graph (validated, optimized)
       │
       ▼
5. Execute tasks in topological order
       │
       ▼
6. Orchestrator.saveResults()
       │  └─→ MemoryClient.addMemory()
       ▼
7. Response to user
```

### Project Indexing Flow

```
1. File Event (add/change/unlink)
       │
       ▼
2. ProjectIndexer.handleFileEvent()
       │
       ▼
3. Queue file for processing
       │
       ▼
4. Check hash (skip if unchanged)
       │
       ▼
5. Chunk file (line-based)
       │
       ▼
6. Generate embeddings (BGE-Large)
       │
       ▼
7. Store in LanceDB
       │
       ▼
8. Update stats
```

---

## Memory System

### Vector Storage (LanceDB)

**Database:** LanceDB (based on Arrow/Parquet)

**Schema:**
```typescript
interface MemoryEntry {
  id: string;           // UUID
  text: string;         // Raw text (max 8192 chars)
  vector: Float32[];    // 1024-dim embedding
  sourceType: SourceType;
  sourcePath: string;
  timestamp: number;
  contentHash: string;  // SHA-256 of content
  metadataJson: string;
  sessionId: string;
}
```

**Index:** HNSW (Hierarchical Navigable Small World)
- `M`: 16 (connections per node)
- `efConstruction`: 100 (search quality during build)

### Search Strategy

**TIERED (default):**
1. Vector search first (topK * 2 candidates)
2. Apply threshold filter
3. Re-rank with text similarity (Fuse.js)
4. Return topK results

**VECTOR_ONLY:**
1. Pure vector similarity search
2. Return topK results

**TEXT_ONLY:**
1. Fuse.js keyword search
2. Return topK results

### Project Chunks

Stored separately from memories in `project_chunks` table:

```typescript
interface ProjectChunk {
  id: string;           // "filepath:chunkIndex"
  filePath: string;
  content: string;
  lineStart: number;   // 1-indexed
  lineEnd: number;
  chunkIndex: number;
  fileHash: string;
  embedding: Float32[];
  indexedAt: number;
}
```

---

## Agent System

### Loading

Agents are loaded from `agents/*.md` files:

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

- **MemoryClient**: Auto-reconnect (max 3 attempts)
- **ProjectIndexer**: Queue continues on failure, logs errors
- **Orchestrator**: Graceful degradation if memory unavailable

---

## Configuration

### Default Values

```typescript
const DEFAULT_INDEX_CONFIG = {
  chunkConfig: {
    chunkSize: 512,
    chunkOverlap: 50,
  },
  watchConfig: {
    include: ['**/*'],
    exclude: ['node_modules', '.git', 'dist', 'build'],
    debounceMs: 300,
  },
  maxConcurrent: 5,
  embeddingModel: 'BAAI/bge-large-en-v1.5',
};
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LANCEDB_URI` | `memory://` | LanceDB storage location |

---

## Dual Architecture

Boomerang-v2 supports two integration modes:

### Built-in Mode (Default)
- Direct imports from `src/memory/`
- Zero serialization overhead
- Automatic initialization
- Used by: Boomerang orchestrator, agents

### MCP Mode (Standalone)
- External process via stdio transport
- JSON-RPC serialization
- Manual configuration required
- Used by: External tools, other AI frameworks
