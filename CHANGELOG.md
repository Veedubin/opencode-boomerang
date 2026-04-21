# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-04-20

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

[0.3.0]: https://github.com/Veedubin/opencode-boomerang/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Veedubin/opencode-boomerang/releases/tag/v0.2.0