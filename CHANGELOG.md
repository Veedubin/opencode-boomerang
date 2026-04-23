# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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