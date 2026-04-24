# Migrating from Boomerang v1

This guide helps you migrate from Boomerang v1 to v2.

## Breaking Changes

| Aspect | v1 | v2 |
|--------|----|----|
| **Language** | Python | TypeScript |
| **Memory System** | Python super-memory | TypeScript MemoryClient |
| **Architecture** | Separate MCP server | Integrated plugin |
| **Agent Definition** | YAML-based | Markdown with frontmatter |
| **Embedding Model** | OpenAI (external) | BGE-Large (local) |
| **Project Indexing** | Manual | Automatic with file watcher |

## Migration Steps

### 1. Backup Existing Configuration

```bash
cp -r ~/.opencode/agents/ ~/opencode-agents.backup/
cp -r ~/.local/share/super-memory/ ~/super-memory.backup/
```

### 2. Install v2

```bash
cd /path/to/boomerang-v2
bun install
bun run build
```

### 3. Update OpenCode Configuration

Edit `~/.config/opencode/opencode.json`:

**Before (v1):**
```json
{
  "mcpServers": {
    "super-memory": {
      "command": "python",
      "args": ["-m", "super_memory"]
    }
  }
}
```

**After (v2):**
```json
{
  "plugins": [
    "@boomerang/v2"
  ]
}
```

### 4. Re-register Agents

The agent definitions in `agents/` directory are auto-loaded. No additional configuration needed.

### 5. Verify Installation

```bash
boomerang --version  # Should print 2.0.0
boomerang chat       # Test memory system
```

## API Changes

### Memory System

| v1 (Python) | v2 (TypeScript) |
|-------------|-----------------|
| `super_memory.add()` | `MemoryClient.addMemory()` |
| `super_memory.search()` | `MemoryClient.queryMemories()` |
| `super_memory.get_context()` | `MemorySystem.getContext()` |

### Orchestrator

| v1 | v2 |
|----|----|
| `Orchestrator.plan()` | `Orchestrator.planTask()` |
| `Orchestrator.execute()` | `TaskGraph` with manual execution |
| N/A | `Orchestrator.validateGraph()` |
| N/A | `Orchestrator.optimizeGraph()` |

### Project Indexing

| v1 | v2 |
|----|----|
| `IndexService.index()` | `ProjectIndexer.indexFile()` |
| `IndexService.search()` | `searchProject()` |
| Manual file watching | Automatic via `chokidar` |

## Data Migration

### Memory Entries

The memory schema has changed from Python dict format to typed `MemoryEntry`:

```typescript
// v2 MemoryEntry schema
interface MemoryEntry {
  id: string;           // UUID
  text: string;        // Raw text
  vector: number[];     // 1024-dim embedding
  sourceType: SourceType;
  sourcePath: string;
  timestamp: number;
  contentHash: string;
  metadataJson: string;
  sessionId: string;
}
```

To export v1 memories:

```bash
# v1 export (Python)
python -c "import super_memory; print(super_memory.export_json())" > memories.json

# v2 import (manual)
# Copy the JSON and use addMemory() for each entry
```

### Project Chunks

Project chunks are stored in LanceDB with HNSW indexes. No direct migration path - re-index projects:

```bash
boomerang index /path/to/project
```

## Configuration Changes

### Agent Definitions

**Before (YAML):**
```yaml
agents:
  - name: boomerang-coder
    model: minimax/M2.7
    skills: [coder]
```

**After (Markdown):**
```markdown
---
description: Boomerang Coder - Fast code generation
model: minimax/MiniMax-M2.7
skills: [coder]
---

You are the Boomerang Coder...
```

### Skill Definitions

Skills are now in `skills/<name>/SKILL.md` format with YAML frontmatter.

## Troubleshooting

### "Agent not found" errors

Ensure agents are in the `agents/` directory and have `.md` extension.

### Memory connection failures

Check that LanceDB is accessible:
```bash
export LANCEDB_URI="memory://"
```

### MCP server not responding

Verify the plugin is registered correctly in OpenCode config.

## Getting Help

- Check `docs/API.md` for API reference
- See `docs/ARCHITECTURE.md` for system design
- Open an issue at the project repository
