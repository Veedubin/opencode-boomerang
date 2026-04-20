# Boomerang Agent Roster

## Core Agents

| Agent | Skill | Model | Role |
|-------|-------|-------|------|
| **boomerang-orchestrator** | boomerang-orchestrator | Kimi K2.5 | Main coordinator. Plans, delegates, enforces protocol |
| **boomerang-coder** | boomerang-coder | MiniMax M2.7 | Fast code generation. Writes and modifies code |
| **boomerang-architect** | boomerang-architect | Kimi K2.5 | Design decisions and architecture review |
| **boomerang-tester** | boomerang-tester | Gemini 3 Pro | Testing specialist. Unit and integration tests |
| **boomerang-explorer** | boomerang-explorer | MiniMax M2.7 | Codebase exploration. Finds files, searches patterns |
| **boomerang-linter** | boomerang-linter | MiniMax M2.7 | Quality enforcement. Lint, format, style |
| **boomerang-git** | boomerang-git | MiniMax M2.7 | Version control. Commits, branches, history |
| **boomerang-writer** | boomerang-writer | Kimi K2.5 | Documentation and markdown writing |
| **boomerang-scraper** | boomerang-scraper | MiniMax M2.7 | Web scraping and research |

## Special Skills

| Skill | Purpose |
|-------|---------|
| **boomerang-init** | Initialize and personalize agents for a project |
| **boomerang-handoff** | Wrap-up session. Updates docs, saves context |

## Agent Selection Guide

- **Code implementation / bug fixes** → `boomerang-coder`
- **Planning / design / architecture** → `boomerang-architect`
- **Code exploration / finding files** → `boomerang-explorer`
- **Web research** → `researcher` or `boomerang-scraper`
- **Writing tests** → `boomerang-tester`
- **Linting / formatting** → `boomerang-linter`
- **Git operations** → `boomerang-git`
- **Documentation / markdown** → `boomerang-writer`

## Super-Memory Requirements

All agents MUST:
1. Query super-memory before starting work
2. Save results to super-memory when complete
3. Use sequential-thinking for complex tasks