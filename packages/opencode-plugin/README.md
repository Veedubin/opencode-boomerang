# @boomerang/opencode-plugin

Multi-agent orchestration plugin for OpenCode with built-in semantic memory.

## Installation

```bash
npm install @boomerang/opencode-plugin
```

## Features

- 🤖 **10 Specialized Agents** - Coder, tester, architect, explorer, and more
- 🧠 **Built-in Memory** - Automatic semantic memory via bundled Python subprocess
- 📊 **Performance Metrics** - Track agent performance and optimize routing
- 🗂️ **Multi-Project Workspaces** - Work across multiple projects
- ⚡ **Automatic Indexing** - Project files indexed automatically on startup
- 🔧 **LLM Provider Agnostic** - Use OpenAI, Anthropic, Google, or local models

## Quick Start

1. Install the plugin:
   ```bash
   npm install -g @boomerang/opencode-plugin
   ```

2. Set your LLM provider:
   ```bash
   export OPENAI_API_KEY=sk-...
   ```

3. The plugin starts automatically with OpenCode.

## Configuration

See [docs/LLM_PROVIDER_GUIDE.md](docs/LLM_PROVIDER_GUIDE.md) for provider setup.

## Documentation

- [Agent Roster](docs/AGENTS.md)
- [Memory Best Practices](docs/super-memory-best-practices.md)
- [Metrics System](docs/METRICS.md)
- [Workspaces](docs/WORKSPACES.md)
- [Migration Guide](docs/MIGRATION-v0.5-to-v0.6.md)

## Requirements

- Node.js ≥20.0.0
- Python 3.11+ (for built-in memory)

## License

MIT
