# 🚀 Boomerang for OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![Multi-Agent Orchestration](https://img.shields.io/badge/Multi--Agent-Orchestration-7c3aed?style=flat-square)]()
[![v1.0.0](https://img.shields.io/badge/v1.0.0-Built--in%20Memory-2ecc71?style=flat-square)]()

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

---

## 🎉 v1.0.0 Highlights

> **First Stable Release!** Built-in Super-Memory is here with zero external dependencies.

| Feature | Description |
|---------|-------------|
| **Built-in Memory** | Super-Memory-TS core imported directly — no external server needed |
| **Auto Indexing** | Project files indexed automatically on plugin load |
| **Background Watching** | chokidar detects changes and updates index incrementally |
| **Metrics Collection** | Track agent performance and routing efficiency |
| **Multi-Project Workspaces** | Switch between projects with isolated memory contexts |

---

## 🚚 Quick Start

### Option 1: One-Click Install (Recommended)

> **Copy and paste the following prompt into a fresh OpenCode Builder session. It will do everything automatically.**

```text
I want you to install the Boomerang multi-agent plugin for OpenCode. Do this step by step:

1. Install the Boomerang package from PyPI. Run: pip install opencode-boomerang (or uv pip install opencode-boomerang if uv is available).

2. Install super-memory from PyPI. Run: pip install super-memory-mcp (or uv tool install super-memory-mcp if uv is available).

3. Edit the project's .opencode/opencode.json file to include:
   - The Boomerang plugin: "plugin": ["opencode-boomerang"]
   - An MCP server entry for super-memory with command ["uvx", "super-memory-mcp"]
   - An MCP server entry for sequential-thinking with command ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]

4. Confirm completion and tell me to:
   a) Restart OpenCode completely
   b) After restart, open the Skills panel (type /skills) and select "boomerang-init" to run the initialization skill
```

---

### Option 2: Manual Install

1. Install Boomerang from PyPI:
   ```bash
   pip install opencode-boomerang
   # Or if using uv
   uv pip install opencode-boomerang
   ```
2. Start OpenCode and run `/boomerang-init` skill
3. Restart OpenCode for agents to load

---

## 🎯 What is Boomerang?

Boomerang is an intelligent multi-agent orchestration plugin for [OpenCode](https://opencode.ai) that coordinates a team of specialized AI agents working together on your codebase. Instead of relying on a single AI, Boomerang implements the **Boomerang Protocol** — a structured 6-step workflow that ensures thorough, consistent, and high-quality code delivery.

> **Think of it as your AI development team lead** — the Orchestrator plans the work, delegates to specialists, enforces quality gates, and ensures nothing falls through the cracks.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              🎯 ORCHESTRATOR (Kimi K2.6)                         │
│   • Plans task execution & dependency graph                       │
│   • Delegates to specialized sub-agents                          │
│   • Enforces quality gates                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   💻        │      │   🏗️        │      │   🔍        │
│  CODER      │      │ ARCHITECT  │      │ EXPLORER   │
│ MiniMax M2.7│      │ Kimi K2.6  │      │ MiniMax M2.7│
└─────────────┘      └─────────────┘      └─────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🧠 BUILT-IN SUPER-MEMORY                        │
│                                                                 │
│   • Direct module import — zero MCP overhead                    │
│   • Automatic project indexing on startup                       │
│   • Background file watching with incremental updates           │
│   • Per-project database isolation                              │
└─────────────────────────────────────────────────────────────────┘
```

### The 6-Step Boomerang Protocol

| Step | Name | Description |
|------|------|-------------|
| **1️⃣** | **Memory** | Query super-memory for context, past decisions, and learnings |
| **2️⃣** | **Think** | Analyze task, build dependency graph, plan execution |
| **3️⃣** | **Delegate** | Assign work to appropriate sub-agents by specialty |
| **4️⃣** | **Git Check** | Verify changes, stage, and commit with proper discipline |
| **5️⃣** | **Quality Gates** | Run lint, typecheck, and tests before completion |
| **6️⃣** | **Save Memory** | Persist decisions and context back to super-memory |

---

## 🤖 Agent Roster

| Agent | Model | Role |
|-------|-------|------|
| **boomerang** | Kimi K2.6 | 🎯 **Orchestrator** — Plans, coordinates, enforces protocol |
| **boomerang-coder** | MiniMax M2.7 | 💻 **Fast code generation** — Write and modify code efficiently |
| **boomerang-architect** | Kimi K2.6 | 🏗️ **Design decisions** — Trade-off analysis and architecture |
| **boomerang-explorer** | MiniMax M2.7 | 🔍 **Codebase exploration** — Find files, search patterns, understand structure |
| **boomerang-tester** | MiniMax M2.7 | 🧪 **Testing specialist** — Unit/integration tests, verification |
| **boomerang-linter** | MiniMax M2.7 | ✅ **Quality enforcement** — Lint, format, style consistency |
| **boomerang-git** | MiniMax M2.7 | 📦 **Version control** — Commits, branches, history discipline |
| **boomerang-writer** | Kimi K2.6 | 📝 **Documentation** — Markdown writing and documentation |
| **boomerang-scraper** | MiniMax M2.7 | 🌐 **Web scraping** — Research and information gathering |
| **boomerang-handoff** | Kimi K2.6 | 🔄 **Session wrap-up** — Context saving and handoff |
| **researcher** | MiniMax M2.7 | 🌐 **Web research** — Search, fetch, and synthesize online information |

---

## 🧠 Super-Memory Integration

> ⚠️ **SUPER-MEMORY IS REQUIRED** — Boomerang will not function without it.

### Why is super-memory required?

Unlike simple context windows, super-memory provides **persistent long-term memory across sessions**. When you start a new OpenCode session, Boomerang agents automatically:

- **Query memory at start** — Retrieve relevant context, past decisions, and learnings from previous sessions
- **Save memory at end** — Persist key decisions, code patterns, and project-specific knowledge

This means Boomerang learns your codebase over time and doesn't repeat mistakes.

### Installation

```bash
# Using uv (recommended)
uv tool install super-memory-mcp

# Or using pip
pip install super-memory-mcp
```

### Configuration

Add super-memory to your global `~/.opencode/opencode.json`:

```json
{
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["uvx", "super-memory-mcp"],
      "enabled": true
    }
  }
}
```

> **Note:** If you installed with `uv run`, use `"command": ["uvx", "super-memory-mcp"]`

### Verify Installation

```bash
super-memory-mcp --version
```

---

## 🔌 Standalone Super-Memory-TS Server

For users who want Super-Memory-TS as a standalone MCP server (without Boomerang):

### Running the Server

```bash
# From the project root
node src/server.ts

# Or with bun
bun run src/server.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LANCEDB_URI` | `memory://` | LanceDB storage location |
| `MODEL_PATH` | (auto) | Path to embedding model |

### MCP Configuration

Add to your MCP client config:

```json
{
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["node", "/path/to/boomerang-v2/src/server.ts"],
      "enabled": true
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `query_memories` | Search memories using semantic similarity |
| `add_memory` | Store a new memory entry |
| `search_project` | Search indexed project files |
| `index_project` | Trigger project indexing |

### Differences from Built-in Mode

| Feature | Built-in (Boomerang) | Standalone (MCP) |
|---------|---------------------|------------------|
| Memory overhead | Zero (direct calls) | JSON serialization + stdio |
| Setup complexity | Automatic on plugin load | Manual server configuration |
| Use case | Boomerang users | External tools, other frameworks |

---

## 📋 Prerequisites

| Dependency | Status | Installation |
|------------|--------|--------------|
| **super-memory** | ⚠️ **Required** | `uv tool install super-memory-mcp` or `pip install super-memory-mcp` |
| **searxng** | 🔧 Optional | Docker: `docker run -d -p 8080:8080 --name searxng searxng/searxng` |
| **sequential-thinking** | ✅ Usually pre-installed | MCP server: `npx -y @modelcontextprotocol/server-sequential-thinking` |

---

## 🚚 Installation

> ⭐ **For the easiest install experience, use the "Vanilla OpenCode Install" prompt above — just copy, paste, and let OpenCode do everything!**

### Option 2: Manual Install

1. Install Boomerang from PyPI:
   ```bash
   pip install opencode-boomerang
   # Or if using uv
   uv pip install opencode-boomerang
   ```
2. Install super-memory from PyPI:
   ```bash
   pip install super-memory-mcp
   # Or if using uv
   uv tool install super-memory-mcp
   ```
3. Update your `.opencode/opencode.json` to include the plugin:
   ```json
   {
     "plugin": ["opencode-boomerang"]
   }
   ```
4. Add super-memory and sequential-thinking MCP configurations (see Configuration section below)
5. Start OpenCode and run `/boomerang-init` skill
6. Restart OpenCode for agents to load

---

## ⚙️ Configuration

### Example `opencode.json`

```json
{
  "plugin": ["opencode-boomerang"],
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["uvx", "super-memory-mcp"],
      "enabled": true
    },
    "searxng": {
      "type": "local",
      "command": ["npx", "-y", "mcp-searxng"],
      "environment": { "SEARXNG_URL": "http://localhost:8080" },
      "enabled": false
    },
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    }
  }
}
```

### Key Configuration Points

| Setting | Description |
|---------|-------------|
| `plugin` | Path to Boomerang plugin dist directory |
| `mcp.super-memory` | **Required** — Long-term memory for agents |
| `mcp.searxng` | Optional — Web search capabilities |
| `mcp.sequential-thinking` | Usually pre-installed — Chain of thought reasoning |

---

## 🔄 The Boomerang Protocol (Detailed)

Every Boomerang session follows this strict protocol:

### Step 1: Memory Query
```
At session start, agents query super-memory for:
• Previous decisions and rationale
• Project-specific patterns and conventions
• Known issues and workarounds
• User preferences and habits
```

### Step 2: Think & Plan
```
The Orchestrator:
• Breaks down the task into subtasks
• Identifies dependencies between subtasks
• Builds an execution DAG (Directed Acyclic Graph)
• Determines which agents to delegate to
```

### Step 3: Delegate
```
Sub-agents are invoked based on specialty:
• Code generation → boomerang-coder
• Design review → boomerang-architect
• Exploration → boomerang-explorer
• Testing → boomerang-tester
• Quality → boomerang-linter
• Version control → boomerang-git
```

### Step 4: Git Check
```
Before any work is considered complete:
• git status shows clean working tree (or changes staged)
• Commits are made with descriptive messages
• Branches are properly managed
```

### Step 5: Quality Gates
```
Mandatory checks before completion:
✓ Lint passes (boomerang-linter)
✓ Typecheck passes (where applicable)
✓ Tests pass (boomerang-tester)
✓ No regression in existing functionality
```

### Step 6: Save Memory
```
At session end, critical information is saved:
• Key architectural decisions
• Code patterns established
• Lessons learned
• User preferences
```

---

## 🔥 Release Pipeline & Updating

When a new version of Boomerang is released:

### 1. Check for Updates
```bash
gh release view Veedubin/opencode-boomerang --json tagName,createdAt
```

### 2. Update Your Installation
```bash
# Update Boomerang from PyPI
pip install --upgrade opencode-boomerang
# Or if using uv
uv pip install --upgrade opencode-boomerang

# Re-run initialization
opencode /boomerang-init
```

### 3. Verify Installation
```bash
# Check the version in your installed plugin
cat .opencode/plugins/boomerang/package.json | grep version
```

---

## 📁 Release Package Contents

The `boomerang.tar.gz` release contains:

```
.opencode/
├── agents/                    # Agent definitions
│   ├── boomerang.md          # Orchestrator
│   ├── boomerang-coder.md    # Code generation
│   ├── boomerang-architect.md # Architecture
│   ├── boomerang-explorer.md  # Exploration
│   ├── boomerang-tester.md    # Testing
│   ├── boomerang-linter.md    # Linting
│   ├── boomerang-git.md       # Git operations
│   └── researcher.md          # Web research
├── skills/                    # Boomerang skills
│   ├── boomerang-architect/
│   ├── boomerang-coder/
│   ├── boomerang-init/
│   ├── boomerang-orchestrator/
│   └── boomerang-tester/
└── plugins/boomerang/        # Plugin implementation (published to NPM separately)
    ├── dist/                  # Compiled JavaScript
    └── package.json

> **Note:** The `plugins/boomerang/` directory is bundled inside the Python package
> assets at `src/opencode_boomerang/assets/.opencode/plugins/boomerang/`. The JavaScript
> plugin can also be published independently to NPM as `@boomerang/opencode-plugin`.
> See [docs/npm-publishing.md](docs/npm-publishing.md) for details.

---

## 📦 NPM Publishing

> **Note:** The Boomerang JavaScript/TypeScript plugin is published to NPM as `@boomerang/opencode-plugin`. The main Python package is published to PyPI. See [docs/npm-publishing.md](docs/npm-publishing.md) for the complete guide.

### Quick Reference

```bash
# Navigate to plugin directory
cd src/opencode_boomerang/assets/.opencode/plugins/boomerang

# Install dependencies
npm install

# Typecheck and build
npm run typecheck
npm run build

# Publish (requires NPM token)
npm publish --access public
```

### Publishing via GitHub Actions

Push a tag matching `plugin-v*.*.*` to trigger automated publishing:

```bash
git tag plugin-v0.3.0
git push origin --tags
```

See [docs/npm-publishing.md](docs/npm-publishing.md) for:
- Complete CI/CD workflow configuration
- Pre-publish checklist
- Version bumping strategy
- Semantic versioning guidelines
- Troubleshooting guide

## 🔬 DeepAgents Research Insights

Boomerang has been benchmarked against [LangChain DeepAgents](https://github.com/langchain-ai/deepagents) (21.3k ⭐) and incorporates several proven patterns:

### Context Isolation
Sub-agents return **only final results**, not intermediate tool outputs. This prevents context bloat and keeps the "dumb zone" away.

### Tool Result Eviction
Large outputs (><500 words) are auto-offloaded to temporary files instead of polluting context.

### Context Compaction
At ~40% context usage, the `/handoff` skill wraps up work, saves state, and allows a fresh start.

### Middleware Hooks (Planned)
Composable pipeline hooks for logging, caching, HITL, and model fallbacks.

### Key Insight
DeepAgents research shows the primary problem sub-agents solve is **context bloat** — not parallelism. As context fills, model quality degrades into a "dumb zone." Boomerang's compaction + isolation strategy directly addresses this.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🚀 by [Veedubin](https://github.com/Veedubin)**

*Your AI development team, on demand.*

</div>
