# 🚀 Boomerang for OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-ff6b35?style=flat-square)](https://opencode.ai)
[![Multi-Agent Orchestration](https://img.shields.io/badge/Multi--Agent-Orchestration-7c3aed?style=flat-square)]()

*Intelligent multi-agent coordination for OpenCode — because great software is a team sport.*

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
│              🎯 ORCHESTRATOR (Kimi K2.5)                         │
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
│ MiniMax M2.7│      │ Kimi K2.5  │      │ MiniMax M2.7│
└─────────────┘      └─────────────┘      └─────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🔄 THE BOOMERANG PROTOCOL                       │
│                                                                 │
│   1️⃣ Memory   →   2️⃣ Think   →   3️⃣ Delegate                  │
│   4️⃣ Git Check →   5️⃣ Quality Gates →   6️⃣ Save Memory        │
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
| **boomerang** | Kimi K2.5 | 🎯 **Orchestrator** — Plans, coordinates, enforces protocol |
| **boomerang-coder** | MiniMax M2.7 | 💻 **Fast code generation** — Write and modify code efficiently |
| **boomerang-architect** | Kimi K2.5 | 🏗️ **Design decisions** — Trade-off analysis and architecture |
| **boomerang-explorer** | MiniMax M2.7 | 🔍 **Codebase exploration** — Find files, search patterns, understand structure |
| **boomerang-tester** | MiniMax M2.7 | 🧪 **Testing specialist** — Unit/integration tests, verification |
| **boomerang-linter** | MiniMax M2.7 | ✅ **Quality enforcement** — Lint, format, style consistency |
| **boomerang-git** | MiniMax M2.7 | 📦 **Version control** — Commits, branches, history discipline |
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
uv tool install super-memory

# Or using pip
pip install super-memory
```

### Configuration

Add super-memory to your global `~/.opencode/opencode.json`:

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

> **Note:** If you installed with `uv run`, use `"command": ["uv", "run", "super-memory"]`

### Verify Installation

```bash
super-memory --version
```

---

## 📋 Prerequisites

| Dependency | Status | Installation |
|------------|--------|--------------|
| **super-memory** | ⚠️ **Required** | `uv tool install super-memory` or `pip install super-memory` |
| **searxng** | 🔧 Optional | Docker: `docker run -d -p 8080:8080 --name searxng searxng/searxng` |
| **sequential-thinking** | ✅ Usually pre-installed | MCP server: `npx -y @modelcontextprotocol/server-sequential-thinking` |

---

## 🚚 Installation

### Option 1: Automated (Recommended)

Start a fresh OpenCode session and simply say:

```
Download and install the Boomerang plugin from:
https://github.com/Veedubin/opencode-boomerang/releases/latest/download/boomerang.tar.gz

Extract it so the .opencode/ directory contents go into my project's .opencode/ directory.
Then run the /boomerang-init skill to complete installation.
```

### Option 2: Manual Install

1. Download the latest release from [GitHub Releases](https://github.com/Veedubin/opencode-boomerang/releases)
2. Extract into your project's `.opencode/` directory:
   ```bash
   tar -xzf boomerang.tar.gz -C /your/project/
   ```
3. Update your `.opencode/opencode.json` to include the plugin:
   ```json
   {
     "plugin": [
       "file:///ABSOLUTE/PATH/TO/YOUR/PROJECT/.opencode/plugins/boomerang/dist"
     ]
   }
   ```
4. Start OpenCode and run `/boomerang-init` skill
5. Restart OpenCode for agents to load

---

## ⚙️ Configuration

### Example `opencode.json`

```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/YOUR/PROJECT/.opencode/plugins/boomerang/dist"
  ],
  "mcp": {
    "super-memory": {
      "type": "local",
      "command": ["super-memory"],
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
# Download the new release
curl -L https://github.com/Veedubin/opencode-boomerang/releases/latest/download/boomerang.tar.gz -o boomerang.tar.gz

# Extract to your project (overwrite existing)
tar -xzf boomerang.tar.gz -C /your/project/

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
└── plugins/boomerang/        # Plugin implementation
    ├── dist/                  # Compiled JavaScript
    └── package.json
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🚀 by [Veedubin](https://github.com/Veedubin)**

*Your AI development team, on demand.*

</div>
