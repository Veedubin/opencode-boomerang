# Boomerang Tasks

> **Strategic Context**: See [ROADMAP.md](./ROADMAP.md) for long-term vision and phase-based goals. This file is for tactical, immediate work.

## In Progress

### Publishing & Distribution

- [ ] Resolve NPM token permissions (needs "Bypass 2FA" for automation)

### Testing & Integration

- [ ] Expand test coverage beyond scraper

## Next Up

### Skill Enhancements

- [ ] Review deepagents SKILL.md pattern for inspiration

### Documentation

- [ ] Create video/tutorial for setup

## Backlog

### Performance & Optimization

- [ ] Agent performance metrics
- [ ] Automatic agent routing optimization
- [ ] Middleware hooks production implementation

### Scalability & Extensibility

- [ ] Support for additional LLM providers
- [ ] Multi-project workspace support
- [ ] Plugin marketplace integration

## Recently Completed ✓

- [x] Publish @veedubin/opencode-boomerang@0.3.0 to NPM
- [x] Fix GitHub Actions workflows (NPM-only, removed PyPI)
- [x] Create boomerang-writer skill for documentation
- [x] Create boomerang-scraper skill for web research
- [x] Create boomerang-init skill for session initialization
- [x] Create boomerang-handoff skill for session wrap-up
- [x] Add comprehensive documentation (ROADMAP.md, docs/, examples/)
- [x] Update orchestrator skill with mandatory session start protocol
- [x] Sync framework to 4 projects (sports-bet, proxy-hop, png2svg, resume-workspace)
- [x] Remove misleading compactor skill
- [x] Add 29 integration tests for scraper (58 total tests passing)
- [x] Fix .gitignore to track TypeScript source files
- [x] Update boomerang-orchestrator skill (markdown reads, sequential thinking, session start protocol, context compaction)
- [x] Update boomerang-init skill (hard rules, protect core prompting, append-only customizations)
- [x] Create/update AGENTS.md with full agent roster
- [x] Create HANDOFF.md template
- [x] Update README.md with new skills and agents
- [x] Rebuilt TypeScript plugin runtime from compiled JS
- [x] Added test infrastructure with 29 passing tests

## Guidelines

- All agents must query super-memory at start and save at end
- Sequential thinking is mandatory for complex tasks
- boomerang-init must only append to default personas, never replace core prompts
- Context compaction triggers at ~40% context usage
- Handoff skill should be called before compaction to preserve state
