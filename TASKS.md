# Boomerang v2 Tasks

> **Strategic Context**: See [ROADMAP.md](./ROADMAP.md) for long-term vision and phase-based goals. This file is for tactical, immediate work tracking.

---

## Current Status

### Session Summary (v2.0.0 Migration)

This session focused on migrating Boomerang to MCP-only memory integration, removing direct Super-Memory-TS dependencies.

**Key Changes:**
- Removed built-in memory fallback (dual-path eliminated)
- Configurable super-memory path via `@super-memory-ts/core` integration
- Migrated to `@veedubin/super-memory-ts` as MCP server plugin
- Fixed model naming inconsistencies across agent prompts

---

## Completed Tasks ✓

### Model & Agent Updates
- [x] Fixed model naming inconsistencies (k2p6, MiniMax M2.7)
- [x] Added `researcher` to `DEFAULT_AGENTS`

### Skills & Documentation
- [x] Created `skills/researcher/SKILL.md` for web research agent
- [x] Updated configuration examples in documentation

### Memory Architecture (MCP-Only)
- [x] Fixed Super-Memory path coupling (configurable path)
- [x] Converted from dual-path memory to MCP-only dependency
- [x] Updated plugin to use `@veedubin/super-memory-ts` as MCP server
- [x] Removed built-in memory fallback

### Previously Completed
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

---

## Remaining Work

### Testing & Integration
- [ ] Test MCP-only memory integration end-to-end
- [ ] Review all agent prompts for MCP tool name consistency
- [ ] Performance test MCP vs old built-in path

### Documentation
- [ ] Update HANDOFF.md with this session's work

### CI/CD
- [ ] Add GitHub Actions for boomerang-v2

### Future Considerations
- [ ] Consider if any agents need model updates
- [ ] Version bump and publish

---

## Next Priorities

| Priority | Task | Notes |
|----------|------|-------|
| 1 | End-to-end test of MCP memory integration | Verify all memory operations work via MCP |
| 2 | Update HANDOFF.md | Document this session's architectural changes |
| 3 | Performance benchmarking | Compare MCP vs built-in memory latency |
| 4 | Version bump to v1.1.0 | Tag and publish |

---

## Guidelines

- All agents must query super-memory at start and save at end
- Sequential thinking is mandatory for complex tasks
- boomerang-init must only append to default personas, never replace core prompts
- Context compaction triggers at ~40% context usage
- Handoff skill should be called before compaction to preserve state
- Each project gets its own `memory_data/` directory (per-project DB isolation)
- Use `super-memory_add_memory` for all saves (add metadata tags for high-value work)
- Use `super-memory_query_memories` with `strategy` parameter for searches

---

*Last Updated: 2025-04-25*
