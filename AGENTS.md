# Boomerang Agent Roster

## Core Agents

| Agent | Skill | Model | Role |
|-------|-------|-------|------|
| **boomerang** | boomerang-orchestrator | Kimi K2.5 | 🎯 **Orchestrator** — Plans, coordinates, enforces protocol |
| **boomerang-coder** | boomerang-coder | MiniMax M2.7 | 💻 **Fast code generation** — Write and modify code efficiently |
| **boomerang-architect** | boomerang-architect | Kimi K2.5 | 🏗️ **Design decisions** — Trade-off analysis and architecture |
| **boomerang-explorer** | boomerang-explorer | MiniMax M2.7 | 🔍 **Codebase exploration** — Find files, search patterns, understand structure |
| **boomerang-tester** | boomerang-tester | MiniMax M2.7 | 🧪 **Testing specialist** — Unit/integration tests, verification |
| **boomerang-linter** | boomerang-linter | MiniMax M2.7 | ✅ **Quality enforcement** — Lint, format, style consistency |
| **boomerang-git** | boomerang-git | MiniMax M2.7 | 📦 **Version control** — Commits, branches, history discipline |
| **boomerang-writer** | boomerang-writer | Kimi K2.5 | 📝 **Documentation** — Markdown writing and documentation |
| **boomerang-scraper** | boomerang-scraper | MiniMax M2.7 | 🌐 **Web scraping** — Research and information gathering |
| **researcher** | researcher | MiniMax M2.7 | 🌐 **Web research** — Search, fetch, and synthesize online information |

| Skill | Purpose | Model |
|-------|---------|-------|
| **boomerang-init** | Initialize and personalize agents for a project | Kimi K2.5 |
| **boomerang-handoff** | Wrap-up session. Updates docs, saves context | Kimi K2.5 |

## Agent Selection Guide

- **Orchestration / coordination** → `boomerang`
- **Code implementation / bug fixes** → `boomerang-coder`
- **Planning / design / architecture** → `boomerang-architect`
- **Code exploration / finding files** → `boomerang-explorer`
- **Writing tests** → `boomerang-tester`
- **Linting / formatting** → `boomerang-linter`
- **Git operations** → `boomerang-git`
- **Documentation / markdown** → `boomerang-writer`
- **Web research** → `researcher` or `boomerang-scraper`
- **Session initialization** → `boomerang-init`
- **Session wrap-up** → `boomerang-handoff`

## Super-Memory Requirements

All agents MUST:
1. Query super-memory before starting work
2. Save results to super-memory when complete
3. Use sequential-thinking for complex tasks

## Project-Specific Context

This is the Boomerang multi-agent orchestration system for OpenCode.