# Boomerang Multi-Project Workspaces

> **Document Version**: 1.0.0  
> **Last Updated**: 2026-04-23  
> **Status**: v1.0.0 Feature Documentation  
> **Scope**: Managing multiple projects with Boomerang

---

## Table of Contents

1. [Overview](#overview)
2. [Adding Projects to Workspace](#adding-projects-to-workspace)
3. [Switching Projects](#switching-projects)
4. [Cross-Project Search](#cross-project-search)
5. [Project Isolation](#project-isolation)
6. [Workspace Commands](#workspace-commands)

---

## Overview

Boomerang v1.0.0 introduces multi-project workspace support, allowing you to work with multiple projects while maintaining isolated memory contexts for each.

### What is a Workspace?

A workspace is a collection of projects that Boomerang knows about. Each project has:
- **Isolated memory**: `memory_data/` directory with separate vector database
- **Project index**: Files indexed specifically for that project
- **Agent context**: Memory queries scoped to current project

### Workspace Structure

```
~/.boomerang/workspaces/
├── default/                    # Default workspace
│   └── projects/
│       ├── project-a/          # Project A
│       │   ├── memory_data/     # Isolated vector DB
│       │   └── project_index/   # File index cache
│       └── project-b/          # Project B
│           └── memory_data/
└── research/                   # Optional named workspace
    └── projects/
        └── project-c/
```

---

## Adding Projects to Workspace

### Command: `/workspace-add`

Add the current directory as a project:

```
/workspace-add [project-name]
```

If `project-name` is not provided, the current directory name is used.

### Example

```text
> /workspace-add my-awesome-project

Adding project: my-awesome-project
✓ Project index created
✓ Memory database initialized
✓ File watcher started

Project 'my-awesome-project' added to workspace.
```

### What Happens During Add

1. **Directory validation**: Ensures the path exists and is a valid project
2. **Memory initialization**: Creates `memory_data/` with fresh LanceDB
3. **Initial indexing**: Starts background file indexing
4. **Workspace registry**: Updates `~/.boomerang/workspaces/current/projects.json`

---

## Switching Projects

### Command: `/workspace-switch`

Switch to a different project:

```
/workspace-switch [project-name]
```

### Example

```text
> /workspace-switch project-b

Switching to: project-b
✓ Memory context switched
✓ Project index updated
✓ Agent context refreshed

Now working on 'project-b'.

Previous project: project-a (1 task in progress)
```

### Active Project Indicator

The orchestrator shows the current project in its context:

```
🎯 Orchestrator [project-b] — 3 tasks in queue
```

### Switching Behavior

When you switch projects:
1. **Memory isolation**: New project has empty memory by default
2. **Project indexing**: Current project files are re-indexed
3. **Context preservation**: Active task state is preserved in HANDOFF.md
4. **Agent reload**: Agents re-initialize with new project context

---

## Cross-Project Search

### Command: `/workspace-search`

Search memories across all projects in workspace:

```
/workspace-search "authentication pattern" [--project project-a]
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `query` | Search query string |
| `--project` | Optional: limit to specific project |
| `--limit` | Max results per project (default: 5) |

### Example

```text
> /workspace-search "error handling pattern"

Searching across 3 projects...
─────────────────────────────────────────
project-a (2 results)
─────────────────────────────────────────
1. "Use Result<T, E> type for error handling..."
2. "Never throw exceptions in src/utils/..."

project-b (1 result)
─────────────────────────────────────────
1. "Error handling: return null on failure..."

project-c (no results)
─────────────────────────────────────────

Found 3 relevant memories across workspace.
```

### Scope Options

| Scope | Description |
|-------|-------------|
| `all` | Search all projects (default) |
| `current` | Search only current project |
| `[project-name]` | Search specific project |

---

## Project Isolation

### Memory Isolation

Each project has a completely isolated memory store:

| Aspect | Isolation Method |
|--------|------------------|
| Vector database | Separate `memory_data/` directory per project |
| Project index | Separate `project_index/` cache per project |
| Memory queries | Automatically scoped to current project |
| Saved memories | Tagged with project name automatically |

### Why Isolation Matters

Without isolation:
- Memory from Project A could pollute Project B context
- Project-specific patterns get confused
- Privacy boundaries blur

With isolation:
- Each project learns only from its own interactions
- Agents maintain clean project context
- Privacy: Project A memories never visible to Project B

### Sharing Across Projects

If you need cross-project knowledge sharing:

```text
> /workspace-search "shared pattern" --scope all --include-shared
```

Or manually save to "shared" project tag:

```javascript
await save_to_memory({
  content: "Cross-project pattern: use this approach in any Python project",
  metadata: {
    project: "shared",  // Special shared namespace
    tags: ["python", "pattern"]
  }
});
```

---

## Workspace Commands

### `/workspace-list`

List all projects in current workspace:

```text
> /workspace-list

Workspace: default (3 projects)
────────────────────────────────
✓ project-a     (active, 128 files indexed)
  project-b     (idle, 89 files indexed)
  project-c     (idle, 234 files indexed)
```

### `/workspace-status`

Show current project detailed status:

```text
> /workspace-status

Current Project: project-a
────────────────────────────────
Memory: 47 memories stored
Index: 128 files (last updated: 2 min ago)
Context usage: 23%
Active tasks: 1

Recent memories:
- "Added auth middleware pattern" (4h ago)
- "User prefers TypeScript strict mode" (1d ago)
```

### `/workspace-remove`

Remove a project from workspace (does not delete files):

```text
> /workspace-remove project-b

Removing project-b from workspace...
✓ Memory context cleared
✓ Project index preserved at: ~/.boomerang/archives/project-b/
✓ Registry updated

Project 'project-b' removed. To fully delete, manually remove ~/.boomerang/archives/project-b/
```

### `/workspace-create`

Create a new named workspace:

```text
> /workspace-create research

Creating workspace: research
✓ Directory created
✓ Configuration initialized

Workspace 'research' created. Switch to it with /workspace-switch --workspace research
```

---

## Configuration

### Workspace Settings

In `opencode.json`:

```json
{
  "boomerang": {
    "workspace": {
      "default_path": "~/.boomerang/workspaces",
      "auto_index": true,
      "index_on_switch": true
    }
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `default_path` | `~/.boomerang/workspaces` | Where workspaces are stored |
| `auto_index` | `true` | Automatically index files on add |
| `index_on_switch` | `true` | Re-index when switching projects |

### Project Settings

Per-project settings in `.boomerang/project.json`:

```json
{
  "name": "project-a",
  "path": "/path/to/project-a",
  "indexed_extensions": [".ts", ".tsx", ".js", ".py", ".md"],
  "excluded_dirs": ["node_modules", ".venv", "dist"],
  "memory_retention_days": 30
}
```

---

## Related Documents

- [AGENTS.md](../AGENTS.md) — Agent roster and model assignments
- [METRICS.md](./METRICS.md) — Metrics collection for workspace optimization
- [super-memory-best-practices.md](./super-memory-best-practices.md) — Memory protocol for workspaces