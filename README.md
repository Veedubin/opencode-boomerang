# Boomerang for OpenCode

Intelligent multi-agent orchestration plugin for OpenCode implementing the Boomerang Protocol.

## What is Boomerang?

Boomerang coordinates a team of specialized AI agents that work together on your codebase:

- **boomerang** (Orchestrator/Kimi K2.5) - Plans, delegates, and coordinates
- **boomerang-coder** (MiniMax M2.7) - Fast code generation
- **boomerang-architect** (Kimi K2.5) - Design decisions and trade-offs
- **boomerang-explorer** (MiniMax M2.7) - Codebase exploration and search
- **boomerang-tester** (MiniMax M2.7) - Test writing and validation
- **boomerang-linter** (MiniMax M2.7) - Quality checks
- **boomerang-git** (MiniMax M2.7) - Git discipline
- **researcher** (MiniMax M2.7) - Web research with SearXNG and Playwright

## Installation

### Option 1: Ask Vanilla OpenCode to Install

Start a fresh OpenCode session in your project and say:

```
Download and extract the Boomerang plugin from:
https://github.com/Veedubin/opencode-boomerang/releases/latest/download/boomerang.tar.gz

Extract it so that the .opencode/ directory contents go into this project's .opencode/ directory.
Then run the /boomerang-init skill to complete installation.
```

### Option 2: Manual Install

1. Download the latest release from GitHub
2. Extract into your project's `.opencode/` directory
3. Update `.opencode/opencode.json` to point the plugin to your local path:
   ```json
   "plugin": [
     "file:///ABSOLUTE/PATH/TO/YOUR/PROJECT/.opencode/plugins/boomerang/dist"
   ]
   ```
4. Start OpenCode and run `/boomerang-init`
5. Restart OpenCode for agents to load

## Prerequisites

Before installing Boomerang, you need to set up **super-memory** (required) and optionally **searxng**.

### 1. Install Super-Memory (Required)

Super-Memory gives Boomerang agents long-term memory across sessions.

```bash
# Using uv (recommended)
uv tool install super-memory

# Or using pip
pip install super-memory
```

Then add it to your `~/.opencode/opencode.json` (global config):

```json
{
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["super-memory"],
      "enabled": true
    }
  }
}
```

If you installed with `uv run` instead of `uv tool install`, use `"command": ["uv", "run", "super-memory"]`.

### 2. Install SearXNG (Optional)

For web research capabilities:

```bash
# Using docker
docker run -d -p 8080:8080 --name searxng searxng/searxng
```

Then add to your global `~/.opencode/opencode.json`:

```json
{
  "mcp": {
    "searxng": {
      "type": "local",
      "command": ["npx", "-y", "mcp-searxng"],
      "environment": { "SEARXNG_URL": "http://localhost:8080" },
      "enabled": true
    }
  }
}
```

### 3. Sequential Thinking (Usually Pre-installed)

Most OpenCode installations already have this. If not:

```json
{
  "mcp": {
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    }
  }
}
```

## License

See [LICENSE](LICENSE)
