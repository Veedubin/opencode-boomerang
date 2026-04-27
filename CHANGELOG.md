# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<<<<<<< HEAD
## [2.3.1] - 2026-04-27

### Sync with Super-Memory-TS v2.3.1
- **MCP timeout fix**: `index_project` now defaults to `background=true` to prevent timeout on large projects
- **index_project_status tool**: Added new tool for polling indexing progress
- **Progress tracking**: Added callback support to indexer for progress tracking

## [2.2.0] - 2026-04-25

### Added (Architectural Recovery Release)
- **Restored built-in Super-Memory-TS integration**
- **Added code-level protocol enforcement**
- **Added automatic context monitoring and compaction**
- **Added metrics collection and dashboard**
- **Added intelligent routing based on performance**
- **Added graceful degradation when memory unavailable**
- **Added real integration tests with LanceDB**
- **Fixed all agent prompts for correct tool names**

## [2.1.5] - 2026-04-25

### Added
- **install-agents script**: `boomerang-install` CLI downloads agent definitions from GitHub
- **CLI command routing**: Fixed CLI to properly handle `install-agents` command

### Fixed
- **npm provenance**: Fixed package name mismatch blocking npm provenance attestation

## [2.1.6] - 2026-04-25

### Fixed (Critical Architecture Recovery)
- **Restored built-in memory integration** — Removed broken MCP-only architecture
- **Deleted memory-client.ts** — Eliminated circular indirection (same codebase spawning itself)
- **Created memory-service.ts** — Direct imports from src/memory/ with zero overhead
- **Protocol enforcement** — Code-level validation replaces honor-system prompts
- **Context monitoring** — Automatic compaction at 40%, handoff at 80%
- **Metrics collection** — Actually wired into task execution
- **Intelligent routing** — Metrics-based agent selection with keyword fallback

### Added
- `src/protocol/tracker.ts` — Session compliance tracking
- `src/protocol/enforcer.ts` — Auto-remediation for protocol violations
- `src/middleware/pipeline.ts` — Composable execution middleware
- `src/context/monitor.ts` — Context window threshold detection
- `src/context/compactor.ts` — Automatic save-and-summarize compaction
- `src/metrics/collector.ts` — Event-driven metrics with JSONL storage
- `src/routing/scoring-router.ts` — Performance-based agent routing

### Changed
- `src/orchestrator.ts` — Uses MemoryService, context monitoring, scoring router
- `src/task-executor.ts` — Protocol enforcement, middleware, metrics emission
- `src/index.ts` — MemoryService initialization

## [2.1.4] - 2026-04-25

### Sync with super-memory-ts v2.1.4
- Updated dependency compatibility

## [1.0.13] - 2026-04-27

### Governance Fix

Updated agent governance to align with boomerang-v2:

- **Architect owns research**: Architect uses `super-memory_search_project` for independent research instead of relying on explorer agents
- **Explorer narrowed scope**: Explorer is now file-finding only (NOT research summaries)
- **Orchestrator updated**: Removed explorer→architect delegation flow; architect does own research
- **Search replaced grep**: All skills updated to use `super-memory_search_project` instead of grep for code search

### Files Changed
- `packages/opencode-plugin/skills/boomerang-orchestrator/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-architect/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-explorer/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-coder/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-git/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-linter/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-tester/SKILL.md`
- `packages/opencode-plugin/skills/boomerang-writer/SKILL.md`
- `packages/opencode-plugin/agents/boomerang-orchestrator.md`
- `packages/opencode-plugin/agents/boomerang-architect.md`
- `packages/opencode-plugin/agents/boomerang-explorer.md`
- `packages/opencode-plugin/agents/boomerang-coder.md`
- `packages/opencode-plugin/agents/boomerang-git.md`
- `packages/opencode-plugin/agents/boomerang-linter.md`
- `packages/opencode-plugin/agents/boomerang-tester.md`
- `packages/opencode-plugin/agents/boomerang-writer.md`
- `packages/opencode-plugin/agents/researcher.md`
- `CHANGELOG.md`
- `AGENTS.md`

## [1.0.0] - 2026-04-23

### 🎉 First Stable Release

This is the first stable release of Boomerang with Super-Memory integration.

### Major Features
- Built-in semantic memory (no external dependencies)
- Automatic project indexing
- Performance metrics collection
- Multi-project workspace support
- LLM provider agnostic configuration
- Bundled agents and skills

### Breaking Changes from v0.5.x
- Memory is now built-in (not external MCP server)
- Project indexing is automatic (no manual tool calls)
- New workspace system for multi-project support
- LLM providers configured per-agent

### Migration
See [docs/MIGRATION-v0.5-to-v1.0.md](docs/MIGRATION-v0.5-to-v1.0.md)

---

## [0.6.0] - 2026-04-23

### Breaking Changes

- **Built-in Super-Memory**: Direct module import replaces MCP as the default integration path. Memory operations are now immediate with zero HTTP overhead.
- **Automatic Project Indexing**: Project files are indexed on plugin load via chokidar file watcher. No manual `index_project` call required.
- **Per-Project DB Isolation**: Each project gets its own `memory_data/` directory. Global shared memory is no longer the default.
- **Version Alignment**: Boomerang v0.6.0 aligns with Super-Memory-TS v0.6.0 for tandem development.

### Migration Notes

Users upgrading from v0.5.x:
1. The built-in memory eliminates the need for standalone super-memory-mcp server (but MCP mode still available for external tools)
2. Project indexing starts automatically - no configuration needed
3. If using MCP mode explicitly, `SUPER_MEMORY_DB_PATH` may need adjustment for new per-project DB layout
4. Run `/boomerang-init` after upgrade to refresh agent definitions

### Added

- **Built-in Super-Memory Integration**: Super-Memory-TS core modules imported directly, no MCP server required
- **Automatic Project Indexing**: chokidar-based file watcher with incremental SHA-256 updates
- **Background File Watching**: Changes detected and indexed continuously after initial scan
- **Agent Performance Metrics**: Collection system for tracking agent efficiency (Phase 4 deliverable)
- **Routing Optimizer**: Automatic agent routing optimization based on metrics (Phase 4 deliverable)
- **Production Middleware Hooks**: wrap_model_call, wrap_tool_call hooks for logging/caching/HITL (Phase 4 deliverable)
- **Multi-Project Workspace Support**: Switch between projects with isolated memory contexts (Phase 5)
- **LLM Provider Configuration Guide**: Comprehensive provider comparison and setup docs

### Changed

- **Memory Architecture**: Dual-mode (Built-in vs MCP) instead of MCP-only
- **Agent Roster**: All 10 agents documented with model assignments
- **Super-Memory Protocol**: Fully mandatory across all agents
- **ROADMAP.md**: Phase 4 marked complete, Phase 5 items detailed

### Documentation

- **METRICS.md**: New guide for metrics overview, collection, and viewing
- **WORKSPACES.md**: New guide for multi-project workspace management
- **MIGRATION-v0.5-to-v0.6.md**: Step-by-step migration guide
- **LLM_PROVIDER_GUIDE.md**: Provider comparison and agent model assignments
- **super-memory-mcp-update-spec.md**: Marked as legacy - built-in is now default

### Technical Details

| Feature | Implementation |
|---------|----------------|
| Built-in Memory | Direct import of Super-Memory-TS modules |
| Project Indexing | chokidar v4 with semantic chunking |
| Vector Search | LanceDB with HNSW index |
| File Watching | Background with debouncing |
| Incremental Updates | SHA-256 hash comparison |

## [0.5.0] - 2026-04-22

### Added
- **5 New Agents**:
  - `boomerang-writer` - Documentation and markdown writing specialist
  - `boomerang-scraper` - Web scraping and research specialist
  - `boomerang-compactor` - Context compaction for preserving critical context
  - `boomerang-init` - Initialize and personalize agents for a project
  - `boomerang-handoff` - Wrap-up session, updates docs and saves context

- **7 New Skills**:
  - Context compaction skill
  - Session initialization skill
  - Session handoff skill
  - Enhanced web scraping capabilities
  - Documentation writing capabilities

### Changed
- **TypeScript Plugin Runtime**: Rebuilt from compiled JS to proper TypeScript source
- **Orchestrator Skill**: Added mandatory session start protocol
- **Agent Discovery**: Fixed by creating missing agent definition files
- **Framework Sync**: Updated to 5 environments

### Fixed
- Agent discovery issues (created missing agent definition files)

### Documentation
- Created ROADMAP.md with project direction
- Created super-memory best practices documentation
- Created backlog-architecture.md with architecture specifications
- Updated AGENTS.md with full agent roster
- Updated README.md with new skills and agents

### Testing
- Added comprehensive test infrastructure
- 58 passing tests (29 new integration tests)
- Context isolation tests
- Tool result eviction tests

### Infrastructure
- Implemented context isolation and tool result eviction
- Added middleware hooks concept (wrap_model_call, wrap_tool_call)
- Enhanced quality gates

## [0.2.0] - Previous Release

### Added
- Initial Boomerang Protocol implementation
- Core agent roster (orchestrator, coder, architect, explorer, tester, linter, git)
- 6-step Boomerang Protocol for code delivery
- Quality gates (lint, typecheck, tests)
- Super-memory integration
- Git discipline enforcement

[0.6.0]: https://github.com/Veedubin/opencode-boomerang/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Veedubin/opencode-boomerang/compare/v0.3.0...v0.5.0
[0.3.0]: https://github.com/Veedubin/opencode-boomerang/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Veedubin/opencode-boomerang/releases/tag/v0.2.0