# Migrating from Legacy super-memory-mcp

## Overview
If you were using the old `super-memory-mcp` package, this guide will help you migrate to Boomerang v1.0.7 with built-in memory.

## What's Changed
- ❌ No more separate `super-memory-mcp` package
- ❌ No more manual MCP server configuration
- ❌ No more Python dependencies to manage
- ✅ Memory is built-in and automatic
- ✅ Project indexing happens automatically
- ✅ Zero configuration required

## Automatic Migration

Run the migration script:
```bash
npx @veedubin/opencode-boomerang migrate
```

This will:
1. Detect your old setup
2. Migrate memory data to new format
3. Update your OpenCode configuration
4. Remove old artifacts

## Manual Migration

### 1. Backup Your Data
```bash
cp -r memory_data memory_data.backup
```

### 2. Uninstall Old Package
```bash
npm uninstall -g super-memory-mcp
# or
pip uninstall super-memory-mcp
```

### 3. Install New Package
```bash
npm install -g @veedubin/opencode-boomerang
```

### 4. Update OpenCode Config

Edit `~/.config/opencode/opencode.json`:

Remove:
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

Add:
```json
{
  "plugins": [
    "@veedubin/opencode-boomerang"
  ]
}
```

### 5. Migrate Memory Data

Copy old memory data:
```bash
mkdir -p ~/.local/share/opencode-boomerang/memory
cp -r ./memory_data/* ~/.local/share/opencode-boomerang/memory/
```

## Data Compatibility

### What's Preserved
- ✅ All stored memories
- ✅ Project indexes
- ✅ Configuration settings

### What's Changed
- Memory storage location (now in `~/.local/share/opencode-boomerang/`)
- Configuration format (now in plugin config)
- No more manual indexing (automatic now)

## Troubleshooting

### Memories Not Found
Check if data was migrated:
```bash
ls ~/.local/share/opencode-boomerang/memory/
```

### Plugin Not Loading
Check OpenCode config:
```bash
cat ~/.config/opencode/opencode.json
```

### Need Help?
Open an issue: https://github.com/Veedubin/opencode-boomerang/issues
