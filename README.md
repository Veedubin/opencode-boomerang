# Boomerang v2

Multi-agent orchestration system with vector memory and project indexing for OpenCode.

## Quick Start

```bash
bun install
bun run build
bun run start
```

### Interactive Mode

```bash
boomerang              # Start interactive TUI
boomerang chat        # Quick chat mode
boomerang index <path>  # Index project
```

## Features

- **Multi-agent orchestration** with loop prevention and dependency graphs
- **Vector memory** using LanceDB with BGE-Large embeddings (1024-dim)
- **Project indexing** with automatic code chunking and file watching
- **Ink-based TUI** for interactive sessions
- **MCP server integration** for tool calls and memory operations
- **12 built-in agents** for specialized tasks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI / TUI                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Plugin Interface (index.ts)                      │
│  - registerCommand()  - registerAgent()  - registerSkill() │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Orchestrator   │ │  MemoryClient   │ │ ProjectIndexer  │
│  (Task Graphs)  │ │  (MCP Client)   │ │ (File Watcher)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │                   │
                              ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server (server.ts)                     │
│         query_memories │ add_memory │ search_project         │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     LanceDB     │ │  MemorySearch   │ │  ModelManager   │
│   (Vector DB)   │ │  (Fuse.js)      │ │ (Transformers)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Commands

| Command | Description |
|---------|-------------|
| `boomerang` | Start interactive TUI with full agent system |
| `boomerang chat` | Quick chat mode for memory queries |
| `boomerang index <path>` | Index a project for searching |

## Built-in Agents (12)

| Agent | Description |
|-------|-------------|
| **boomerang** | Main orchestrator - coordinates sub-agents, plans tasks |
| **boomerang-explorer** | Codebase exploration, file finding, pattern search |
| **boomerang-coder** | Fast code generation and implementation |
| **boomerang-tester** | Unit and integration testing specialist |
| **boomerang-architect** | Design decisions and architecture review |
| **boomerang-writer** | Documentation and markdown writing |
| **boomerang-git** | Version control operations |
| **boomerang-linter** | Code quality and formatting |
| **boomerang-init** | Project initialization and customization |
| **boomerang-handoff** | Session wrap-up and context preservation |
| **boomerang-scraper** | Web scraping and research |
| **researcher** | Web research and information gathering |

## Development

```bash
bun test           # Run all tests
bun test:coverage # Run tests with coverage report
bun run build     # Build TypeScript to dist/
```

### Test Coverage

Tests are organized by module:

- `tests/memory/` - Memory system tests
- `tests/project-index/` - Indexer and chunker tests
- `tests/orchestrator.test.ts` - Task graph and orchestration
- `tests/tui/` - Terminal UI components
- `tests/integration/` - Full pipeline tests
- `tests/mcp/` - MCP server tests

## Project Structure

```
boomerang-v2/
├── agents/           # Agent definition markdown files
├── skills/           # Skill definitions (SKILL.md files)
├── src/
│   ├── index.ts      # Plugin entry point
│   ├── orchestrator.ts   # Task planning and dependency graphs
│   ├── memory-client.ts  # MCP client for memory ops
│   ├── memory/       # Memory system (LanceDB + search)
│   ├── project-index/   # File chunking and indexing
│   ├── model/        # Embedding model management
│   ├── tui/          # Ink-based terminal UI
│   └── server.ts     # MCP server implementation
└── docs/             # Extended documentation
```

## Configuration

The plugin uses environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LANCEDB_URI` | `memory://` | LanceDB connection URI |

## Dependencies

- **@lancedb/lancedb** - Vector database
- **@modelcontextprotocol/sdk** - MCP protocol
- **@xenova/transformers** - Embedding models
- **ink** - Terminal UI framework
- **fuse.js** - Fuzzy text search
