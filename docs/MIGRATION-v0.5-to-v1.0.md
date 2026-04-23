# Migration Guide: v0.5 to v1.0

> **Document Version**: 1.0.0  
> **Last Updated**: 2026-04-23  
> **Status**: Migration Guide  
> **Scope**: Upgrading from Boomerang v0.5.x to v1.0.0

---

## Overview

Boomerang v1.0.0 introduces **built-in Super-Memory** as the default integration path, eliminating the need for a standalone MCP server while maintaining MCP compatibility for external tools. This guide walks you through the breaking changes and how to migrate smoothly.

---

## Breaking Changes Summary

| Change | Impact | Migration Effort |
|--------|--------|------------------|
| Built-in memory replaces MCP | No MCP server needed for Boomerang | Low - automatic |
| Auto project indexing | No manual `index_project` call | None |
| Per-project DB isolation | Each project gets own `memory_data/` | Low - automatic |
| Version alignment | Boomerang and Super-Memory-TS now aligned | None |

---

## Step-by-Step Migration

### Step 1: Update Boomerang Package

```bash
# Update from PyPI
pip install --upgrade opencode-boomerang

# Or if using uv
uv pip install --upgrade opencode-boomerang
```

### Step 2: Verify Installation

```bash
# Check Python package version
pip show opencode-boomerang | grep Version
# Should show: Version: 1.0.0

# Check plugin version
cat .opencode/plugins/boomerang/package.json | grep version
# Should show: "version": "1.0.0"
```

### Step 3: Restart OpenCode

Close and reopen OpenCode to load the new plugin version.

### Step 4: Run Initialization

```
/boomerang-init
```

This refreshes agent definitions with v1.0.0 updates.

---

## Configuration Changes

### Old Configuration (v0.5.x)

If you had explicit MCP configuration for super-memory:

```json
{
  "plugin": ["opencode-boomerang"],
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["uvx", "super-memory-mcp"],
      "enabled": true
    },
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    }
  }
}
```

### New Configuration (v1.0.0)

The built-in memory eliminates the need for `mcp.super-memory`. Keep MCP configuration only if you have external tools that need super-memory access:

```json
{
  "plugin": ["opencode-boomerang"],
  "mcp": {
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    }
  }
}
```

### MCP Mode (Optional/Advanced)

If you have external tools (non-Boomerang) that need super-memory access, keep the MCP configuration:

```json
{
  "plugin": ["opencode-boomerang"],
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["uvx", "super-memory-mcp"],
      "enabled": true
    },
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    }
  }
}
```

---

## Memory Database Changes

### Automatic Migration

v1.0.0 automatically handles the transition:

1. **Existing memories are preserved** - Your current `memory_data/` contents remain accessible
2. **Per-project isolation** - New projects get fresh `memory_data/` directories
3. **No manual migration needed** - Boomerang reads your existing memories

### What Changes

| Before (v0.5.x) | After (v1.0.0) |
|-----------------|----------------|
| Single global `memory_data/` | Per-project `memory_data/` |
| MCP server for memory ops | Direct module import |
| Manual project indexing | Automatic on plugin load |

### If Using MCP Mode Explicitly

If you were using `SUPER_MEMORY_DB_PATH` environment variable for MCP mode:

```bash
# Old path (global)
export SUPER_MEMORY_DB_PATH=/path/to/shared/memory_data

# New path (per-project - usually automatic)
# No environment variable needed for built-in mode
# For MCP mode, set to specific project's memory_data
```

---

## Agent Protocol Updates

The mandatory super-memory protocol remains unchanged:

### Before Each Task
```
1. Query super-memory for context
2. Use sequential-thinking for complex tasks
```

### After Each Task
```
1. Save key decisions to super-memory
2. Wrap up with boomerang-handoff if needed
```

---

## Verification Checklist

After migration, verify everything works:

- [ ] Boomerang plugin loads without errors
- [ ] `/boomerang-init` completes successfully
- [ ] Agents respond to queries
- [ ] Memory is being saved and retrieved
- [ ] Project files are being indexed
- [ ] Metrics are being collected (optional)

### Quick Test

```text
# Test 1: Agent loads
> /boomerang

# Test 2: Memory works
> Create a memory about test migration

# Test 3: Project indexing
> How many files are indexed in this project?

# Test 4: Search works
> Find memories about authentication
```

---

## Troubleshooting

### "Plugin failed to load" Error

1. Check version: `pip show opencode-boomerang` should be 1.0.0
2. Clear cache: Remove `.opencode/plugins/boomerang/dist`
3. Restart OpenCode completely

### Memory Not Persisting

1. Check `memory_data/` exists in project root
2. Verify write permissions
3. Check disk space

### Index Not Building

1. Ensure project has supported file types (.ts, .tsx, .js, .py, .md, .json)
2. Check excluded directories aren't blocking everything
3. Verify file watcher permissions

---

## Rollback Instructions

If v1.0.0 causes issues:

```bash
# Uninstall current version
pip uninstall opencode-boomerang

# Install specific previous version
pip install opencode-boomerang==0.6.0

# Restart OpenCode
```

---

## Getting Help

- **Documentation**: See [docs/](.) for all guides
- **Issues**: https://github.com/Veedubin/opencode-boomerang/issues
- **Discussions**: https://github.com/Veedubin/opencode-boomerang/discussions

---

## Related Documents

- [README.md](../README.md) — v1.0.0 feature overview
- [AGENTS.md](../AGENTS.md) — Agent roster and protocol
- [METRICS.md](./METRICS.md) — Metrics collection
- [WORKSPACES.md](./WORKSPACES.md) — Multi-project support