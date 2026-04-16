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

## Required MCPs

Boomerang expects these MCP servers in your `opencode.json`:

- **sequential-thinking** - `@modelcontextprotocol/server-sequential-thinking`
- **super-memory** - `uv run super-memory`
- **searxng** - `mcp-searxng` (optional but recommended)

## License

See [LICENSE](LICENSE)
