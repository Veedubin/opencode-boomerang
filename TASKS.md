# Boomerang Tasks

> **Strategic Context**: See [ROADMAP.md](./ROADMAP.md) for long-term vision and phase-based goals. This file is for tactical, immediate work.

## In Progress

### Publishing & Distribution

- [ ] Push v0.5.0 tag to GitHub
- [ ] Publish @veedubin/opencode-boomerang@0.5.0 to NPM
- [ ] Publish opencode-boomerang@0.5.0 to PyPI (if maintaining dual publish)
- [ ] Resolve NPM token permissions (needs "Bypass 2FA" for automation)
- [ ] Update embedded assets package.json (src/opencode_boomerang/assets/.opencode/plugins/boomerang/package.json still at 0.3.0)

### Testing & Integration

- [ ] Expand test coverage beyond scraper
- [ ] Test per-project DB isolation across multiple repos
- [ ] Verify tiered memory search (Fast Reply vs Archivist)

## Next Up

### Skill Enhancements

- [ ] Review deepagents SKILL.md pattern for inspiration
- [ ] Test architect-first planning workflow end-to-end
- [ ] Verify all 11 agents load correctly with new K2.6 model assignments

### Documentation

- [ ] Update ROADMAP.md to reflect completed Phase 3 items
- [ ] Create video/tutorial for setup
- [ ] Document tiered memory architecture for users

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

- [x] **v0.5.0 Release** — Version bumped, tagged, ready to push
- [x] **Read all OpenCode documentation** — 13 docs pages cached in super-memory
- [x] **Fixed super-memory protocol** — Made MANDATORY for all 11 sub-agents
- [x] **Model upgrade** — All agents updated from Kimi K2.5 to K2.6
- [x] **Boomerang restrictions** — Markdown-only reads, git-only bash commands
- [x] **Architect-first planning** — Mandatory architect review before build tasks
- [x] **Missing agents** — Copied writer, scraper, init, handoff to src/assets
- [x] **SKILL.md fixes** — Corrected wrong model names in documentation
- [x] **Super-memory-mcp updates** — Added tiered search tools, corruption detection
- [x] **Fixed hanging issue** — steps:50 limit, error handling, anti-loop safety
- [x] **Per-project DB isolation** — Each repo gets its own memory_data/ directory
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
- Each project gets its own `memory_data/` directory (per-project DB isolation)
- Use `boomerang_memory_save_long` for high-value work (architectural decisions, session summaries)
- Use `boomerang_memory_search_tiered` for Fast Reply, `boomerang_memory_search_parallel` for Archivist mode
