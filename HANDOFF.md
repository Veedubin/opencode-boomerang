# Boomerang Handoff

## Session History

### 2026-04-27 — Skill System Overhaul + index_project Bug Fix

**Status**: Session complete, quality gates passed

#### What Was Accomplished

1. **Skill System Overhaul**
   - Updated all 8 agent skill files with correct MCP tool names (fixed outdated names)
   - Made Super-Memory Protocol MANDATORY in all skills (query at start, save at end)
   - Added agent-type-specific metadata guidance
   - Added Bug Discovery Protocol to explorer skill (decision tree for fix vs report, structured bug report format)
   - Created new `boomerang-release` skill for automated version bumping and publishing
   - Enhanced `boomerang-writer` skill with Documentation Maintenance standards

2. **Critical Bug Fix: index_project Path Parameter**
   - Fixed `Super-Memory-TS/src/server.ts` where `index_project` MCP tool ignored the `path` parameter
   - Added `getRootPath()` and `setRootPath()` methods to `src/project-index/indexer.ts`
   - Updated handler to pass path to indexer and support on-demand indexer creation
   - Added tests in `tests/project-index.test.ts`

3. **Deprecation Warning Mitigation**
   - Added `sharp@0.33.0` override to address `prebuild-install@7.1.3` deprecation
   - Full fix blocked by `@xenova/transformers` peer dependency

#### Key Decisions

- Skill system now enforces Super-Memory Protocol consistently across all agents
- Bug Discovery Protocol gives explorers clear decision tree: fix vs report
- `boomerang-release` skill automates version bumping and publishing workflow
- `index_project` path parameter now properly routed to indexer

#### Files Modified

- `skills/*/SKILL.md` - all 8 skill files updated with correct MCP tool names
- `skills/boomerang-release/SKILL.md` - new skill for automated publishing
- `skills/boomerang-writer/SKILL.md` - enhanced with documentation maintenance
- `skills/boomerang-explorer/SKILL.md` - added Bug Discovery Protocol
- `Super-Memory-TS/src/server.ts` - index_project path fix
- `Super-Memory-TS/src/project-index/indexer.ts` - getRootPath/setRootPath
- `Super-Memory-TS/tests/project-index.test.ts` - new tests
- `Super-Memory-TS/package.json` - sharp@0.33.0 override

#### Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| `database.ts:189` lint error | **Pre-existing** | Unused `err` variable |
| 3 integration test failures | **Pre-existing** | Qdrant not running |
| sharp deprecation | **Partial** | Override added, peer dep blocks full fix |

#### Next Session Priorities

1. **Verify skill system** changes work end-to-end with agents
2. **Test index_project** with custom path parameter
3. **Review boomerang-release** skill for publishing workflow
4. **Fix lint error** in `database.ts:189` (pre-existing)

#### Super-Memory Reference

Query `super-memory_query_memories` with:
- `"skill system overhaul mandatory protocol boomerang"`
- `"index_project path parameter fix"`
- `"Bug Discovery Protocol explorer skill"`

---

### 2026-04-27 — Super-Memory-TS v2.2.1 Bug Fixes

**Status**: v2.2.1 released, MCP connection issue resolved

#### What Was Accomplished

1. **Fixed projectId Loss Bug**
   - MCP server was not including `projectId` in tool responses
   - Added `projectId` to all tool result schemas and response handlers
   - Affects: `search_project`, `index_project`, `query_memories`, `add_memory`

2. **Fixed Qdrant Filter Format**
   - `with_filter` was receiving an array `[field, value]` instead of an object `{key: value}`
   - Corrected filter construction in `qdrant-hybrid.ts` search methods
   - Resolved memory query failures when filtering by projectId

3. **Released v2.2.1**
   - Fixed `package.json` version in `dist/`
   - Published to NPM: `@veedubin/super-memory-ts@2.2.1`

#### Key Decisions

- Fixes are in Super-Memory-TS but affect boomerang-v2's MCP memory integration
- MCP memory tools in boomerang-v2 depend on correct tool schema from Super-Memory-TS
- Connection issue was actually the `projectId` missing from tool metadata

#### Next Session Priorities

1. Test MCP memory tools work after OpenCode restart
2. Verify project isolation with new v2.2.1 installation
3. Collect routing metrics (still need 5+ samples)

---

### 2026-04-26 — Boomerang Init + Agent Customization

**Status**: Session complete

#### What Was Accomplished

1. **Boomerang Init**
   - Customized 12 existing agent files in both `.opencode/agents/` and `boomerang-v2/agents/`
   - Created 1 new agent: `mcp-specialist.md` (MCP Protocol specialist for tool design and server debug)
   - Added project-specific context (MCP-Servers domain, TypeScript conventions, build commands)
   - Updated `AGENTS.md` with review notes

2. **Project Context Added to Agents**
   - TypeScript/Bun runtime conventions
   - Build/test/lint commands for both `boomerang-v2/` and `Super-Memory-TS/`
   - MCP Protocol integration patterns
   - Memory system architecture details

#### Files Created

- `.opencode/agents/mcp-specialist.md` (new agent)
- `agents/mcp-specialist.md` (synced copy)

#### Files Modified

- All `agents/*.md` files (12 agents) - appended project-specific context
- `AGENTS.md` - added review notes with date

#### Next Session Priorities

1. Test built-in memory integration with new agent customizations
2. Verify MCP server connection works after Super-Memory-TS v2.2.0 installation
3. Collect metrics for intelligent routing (need 5+ samples)

---

### 2026-04-25 — v2.1.6 (Architectural Recovery)

**Status**: v2.1.6 committed, all 5 phases complete

#### What Was Accomplished

1. **Phase 1: Restored Built-in Integration**
   - Created `src/memory-service.ts` with direct imports from `src/memory/`
   - Deleted `src/memory-client.ts` (circular MCP indirection)
   - Modified `src/index.ts`, `src/orchestrator.ts`, `src/task-executor.ts` to use MemoryService
   - Zero serialization overhead for memory operations

2. **Phase 2: Protocol Enforcement**
   - Created `src/protocol/tracker.ts` — per-session compliance tracking
   - Created `src/protocol/enforcer.ts` — blocks execution on violations, auto-fixes when possible
   - Created `src/middleware/pipeline.ts` — composable middleware
   - Git check and quality gates are now automatic, not optional

3. **Phase 3: Metrics Collection**
   - Created `src/metrics/collector.ts` — event-driven with JSONL storage
   - Emits task.started, task.completed, task.failed, routing.decision events
   - Actually wired into task-executor.ts and orchestrator.ts

4. **Phase 4: Context Monitoring**
   - Created `src/context/monitor.ts` — 40% compaction, 80% handoff thresholds
   - Created `src/context/compactor.ts` — save summary to memory, reset context
   - Automatic triggers in orchestrator lifecycle

5. **Phase 5: Intelligent Routing**
   - Created `src/routing/scoring-router.ts` — weighted scoring from metrics
   - Falls back to keyword routing when < 5 samples
   - Integrated into orchestrator.ts planTask()

#### Key Decisions

- Built-in integration is the ONLY path for boomerang-v2
- MCP server remains for external users (src/server.ts)
- Protocol enforcement is configurable via EnforcementConfig
- Auto-fix attempts remediation before blocking
- Metrics require 5+ samples before affecting routing

#### Files Created

- src/memory-service.ts
- src/protocol/tracker.ts
- src/protocol/enforcer.ts
- src/middleware/pipeline.ts
- src/context/monitor.ts
- src/context/compactor.ts
- src/metrics/collector.ts
- src/routing/scoring-router.ts

#### Files Modified

- src/index.ts (MemoryService integration)
- src/orchestrator.ts (MemoryService, context monitor, scoring router)
- src/task-executor.ts (protocol enforcement, middleware, metrics)
- src/tui/index.tsx, src/tui/hooks/useAgent.ts (MemoryService)
- tests/integration/mcp-memory.test.ts (MemoryService tests)
- tests/performance/mcp-benchmark.test.ts (MemoryService benchmarks)

#### Files Deleted

- src/memory-client.ts (broken MCP indirection)

#### Next Session Priorities

1. Test protocol enforcement in real workflows
2. Verify context compaction triggers correctly
3. Collect enough metrics for routing to be meaningful
4. Push to GitHub and verify CI passes

---

### 2026-04-25 — v1.1.0 (MCP-Only Release)

**Status**: v1.1.0 tagged and committed

#### What Was Accomplished

1. **MCP Tool Name Consistency**
   - Fixed all agent prompts (12 agents) to use correct MCP tool names
   - Updated all skill files (12 skills) with accurate tool references
   - Corrected `super-memory_query_memory` → `super-memory_query_memories` (plural)
   - Corrected `super-memory_save_to_memory` / `boomerang_memory_save_long` → `super-memory_add_memory`
   - Added strategy parameter documentation for tiered vs vector_only searches

2. **End-to-End MCP Integration Tests**
   - Created `tests/integration/mcp-memory.test.ts` with 17 tests
   - Tests all 4 MCP tools: query_memories, add_memory, search_project, index_project
   - Tests connection handling, error cases, and full workflow scenarios
   - All tests passing

3. **Performance Benchmarks**
   - Created `tests/performance/mcp-benchmark.test.ts`
   - Measures MCP overhead per call (<50ms target)
   - Tests throughput (100+ ops/sec target)
   - Simulates typical agent workflow (query + add + search)
   - All benchmarks passing

4. **CI/CD Pipeline**
   - Created `.github/workflows/ci.yml` for PR/push validation
   - Tests both root package and plugin package
   - Runs typecheck, tests, and build verification
   - Existing publish workflows remain unchanged

5. **Version Bump & Release**
   - Aligned root package (was 2.1.4) and plugin package (was 2.1.5) to v1.1.0
   - Updated `src/index.ts` VERSION constant
   - Updated CHANGELOG.md with v1.1.0 entry
   - Created git tag `v1.1.0`
   - Committed all changes (44 files, 725 insertions, 127 deletions)

#### Key Decisions

- All memory operations use `super-memory_add_memory` (no separate save_long tool)
- Strategy parameter controls search behavior: `tiered`, `vector_only`, `text_only`
- Metadata tags distinguish high-value saves (e.g., `project: "name"`, `type: "decision"`)
- MCP-only architecture is now fully tested and documented

#### Files Modified

- All `agents/*.md` files (12 agents) - tool name fixes
- All `skills/*/SKILL.md` files (12 skills) - tool name fixes
- `packages/opencode-plugin/skills/*/SKILL.md` - synced changes
- `AGENTS.md` - corrected MCP tool documentation
- `TASKS.md` - updated completed tasks and next priorities
- `CHANGELOG.md` - added v1.1.0 release notes
- `package.json` (root and plugin) - version bump to 1.1.0
- `src/index.ts` - VERSION constant update
- `.github/workflows/ci.yml` - new CI workflow
- `tests/integration/mcp-memory.test.ts` - new test file
- `tests/performance/mcp-benchmark.test.ts` - new benchmark file

#### Next Session Priorities

1. Push v1.1.0 tag to GitHub (`git push origin v1.1.0`)
2. Verify NPM publish succeeds
3. Test installation in production environment
4. Monitor CI/CD workflow on next PR

---

### 2026-04-25 — v1.1.0-pre (MCP-Only Memory Migration)

**Status**: v1.1.0-pre (MCP-only memory migration)

#### What Was Accomplished

1. **Super-Memory-TS Critical Bug Fixes** (separate project)
   - Fixed TIERED search strategy (was only doing text search, now does vector + text)
   - Fixed VECTOR_ONLY search strategy (was falling back to text, now does real vector search)
   - Removed forced TEXT_ONLY fallback in server
   - Fixed database initialization error handling (was silently swallowing errors)
   - Added Qdrant connection health check

2. **Super-Memory-TS MCP SDK Modernization** (separate project)
   - Migrated from legacy Server class to McpServer with Zod validation
   - Added tool annotations (readOnlyHint, destructiveHint)
   - Replaced console.log with logger (fixes stdio transport corruption)

3. **Super-Memory-TS Type Safety** (separate project)
   - Added proper type guards for vector handling (removed any casts)
   - Fixed race condition in Fuse.js initialization
   - Added score preservation from Qdrant results
   - Fixed MemorySystem to respect config
   - Optimized Qdrant payload settings (with_vector: false for reads)

4. **Super-Memory-TS Tests & Docs** (separate project)
   - Added integration tests with Qdrant
   - Added search strategy unit tests
   - Updated README (replaced all LanceDB references with Qdrant)
   - Renamed dbPath to qdrantUrl with backward compatibility
   - Created eslint.config.js for ESLint v9

5. **Boomerang-v2 Model Fixes**
   - Fixed model naming inconsistencies (orchestrator: k2p6, coder: MiniMax M2.7)
   - Added researcher to DEFAULT_AGENTS
   - Created skills/researcher/SKILL.md

6. **Boomerang-v2 MCP-Only Memory Migration**
   - Converted from dual-path (built-in + MCP) to MCP-only dependency
   - Removed direct Super-Memory-TS imports
   - All memory operations now route through MCP tools
   - Removed Python subprocess (memory-engine.ts)
   - Updated configuration to use @veedubin/super-memory-ts

7. **Task Tracking**
   - Created TASKS.md for both Super-Memory-TS and boomerang-v2

#### Key Decisions

- Super-Memory-TS is now a standalone MCP server that boomerang-v2 depends on
- Built-in memory path removed - cleaner architecture, single source of truth
- All 12 agents confirmed present and accounted for
- Agent swarm integrity score: 8.5/10 (fixed config drift issues)

#### Files Modified

- See commits 7dab7f5 (Super-Memory-TS) and cd93abd (boomerang-v2)

#### Next Session Priorities

1. End-to-end test MCP memory integration
2. Fix remaining ESLint issues in Super-Memory-TS
3. Add GitHub Actions for both projects
4. Performance benchmarking
5. Version bump and publish

---

### 2026-04-23 — v1.0.0 Documentation Audit

**Status**: v1.0.0 release documentation complete

#### What Was Accomplished

1. **Documentation Audit Completed**
   - Checked all core docs against audit checklist
   - Updated CHANGELOG.md with v1.0.0 features
   - Updated README.md with v1.0.0 highlights section
   - Updated ROADMAP.md with Phase 4 complete, Phase 5 in progress

2. **Version Bumps**
   - pyproject.toml: 0.6.0 → 1.0.0
   - package.json: 0.6.0 → 1.0.0

3. **Documentation Created**
   - docs/METRICS.md - Metrics overview and collection guide
   - docs/WORKSPACES.md - Multi-project workspace management
   - docs/MIGRATION-v0.5-to-v1.0.md - Migration guide for v0.5.x users
   - docs/LLM_PROVIDER_GUIDE.md - Provider comparison and agent assignments

4. **Docs Marked Deprecated**
   - docs/super-memory-mcp-update-spec.md - Legacy doc (built-in is now default)

#### Key Decisions This Session

- Built-in memory is now the primary integration path
- MCP mode remains available for external tool compatibility
- Version alignment: Boomerang v1.0.0 with Super-Memory-TS v1.0.0

#### Files Modified

- boomerang/CHANGELOG.md — v1.0.0 entry with breaking changes
- boomerang/README.md — v1.0.0 highlights and architecture update
- boomerang/ROADMAP.md — Phase 4 complete, Phase 5 details
- boomerang/pyproject.toml — version 0.6.0 → 1.0.0
- boomerang/package.json — version 0.6.0 → 1.0.0

#### Files Created

- boomerang/docs/METRICS.md
- boomerang/docs/WORKSPACES.md
- boomerang/docs/MIGRATION-v0.5-to-v1.0.md
- boomerang/docs/LLM_PROVIDER_GUIDE.md

---

#### What Was Accomplished

1. **Built-in Super-Memory Architecture**
   - Super-Memory-TS core modules now imported directly into Boomerang
   - No MCP server required for Boomerang operation
   - Eliminates HTTP latency and protocol overhead

2. **Automatic Project Indexing**
   - Project indexing starts automatically when Boomerang plugin loads
   - File watcher (chokidar) runs continuously in background
   - Incremental updates via SHA-256 hash comparison

3. **Version Alignment**
   - Boomerang: v0.5.0 → v0.6.0
   - Super-Memory-TS: v0.2.0 → v0.6.0
   - Both projects now version-aligned for tandem development

4. **Documentation Updates**
   - ROADMAP.md: Added Phase 4 built-in memory deliverables
   - AGENTS.md: Documented dual integration architecture (built-in vs MCP)
   - HANDOFF.md: Added v0.6.0 session entry
   - Super-Memory-TS README.md: Clarified dual use cases
   - Super-Memory-TS CHANGELOG.md: Expanded v0.6.0 entry

#### Key Decisions This Session

- **Built-in is default**: Direct module import is the primary integration path
- **MCP is for external tools**: Cross-session persistence only when needed by other frameworks
- **Version sync**: Both projects at v0.6.0 to indicate breaking-change alignment
- **Automatic indexing**: No manual intervention required for project setup

#### Files Modified

- boomerang/ROADMAP.md — Phase 4 with built-in memory
- boomerang/AGENTS.md — Dual integration architecture
- boomerang/HANDOFF.md — v0.6.0 session entry
- Super-Memory-TS/README.md — Architecture section updated
- Super-Memory-TS/CHANGELOG.md — v0.6.0 entry expanded

---

### 2026-04-22 — v0.5.0 Massive Update Session

**Status**: v0.5.0 tagged, ready to push to GitHub and publish to NPM

#### What Was Accomplished

1. **Read all OpenCode documentation** (13 docs pages) and cached in super-memory for agent context
2. **Fixed super-memory protocol** — Made it MANDATORY for all 11 sub-agents (was optional before). Updated all agent prompts to enforce query-first, sequential-thinking, and save-at-end
3. **Model upgrade** — Updated all agents from Kimi K2.5 to K2.6 (orchestrator, architect, writer, init, handoff)
4. **Boomerang restrictions** — Limited to markdown-only file reading, restricted bash to git commands only for safety
5. **Architect-first planning** — Added mandatory architect review before build tasks in orchestrator workflow
6. **Missing agents** — Copied boomerang-writer, scraper, init, handoff skill definitions to `src/opencode_boomerang/assets/` so they're included in the Python package
7. **SKILL.md fixes** — Corrected wrong model names in documentation (K2.5 → K2.6)
8. **Super-memory-mcp updates**:
   - Added `boomerang_memory_search_tiered` and `boomerang_memory_search_parallel` tools
   - Added corruption detection and recovery for ChromaDB collections
   - Per-project DB isolation: removed hardcoded global DB path, each repo now gets its own `memory_data/`
9. **Fixed hanging issue**:
   - Added `steps:50` limit to prevent infinite loops
   - Error handling for memory failures
   - Anti-loop Task safety rules (no Task tools in sub-agents)
10. **Version bump** — pyproject.toml 0.3.0 → 0.5.0, package.json 0.4.0 → 0.5.0
11. **.gitignore** — Added `memory_data/` to prevent committing per-project memory databases

#### Key Decisions This Session

- **Super-memory is mandatory, not optional** — All agents must query before work and save after
- **Tiered memory architecture** — Fast Reply (MiniLM) for speed, Archivist (BGE+RRF) for maximum recall
- **Per-project DB isolation** — Each repo gets its own `memory_data/` directory instead of a global DB
- **Boomerang safety restrictions** — Markdown reads only, git-only bash to prevent accidental damage
- **Architect-first workflow** — Build tasks require architect review before coding begins
- **Model upgrade to K2.6** — Kimi K2.6 for reasoning agents, MiniMax M2.7 for fast execution agents

#### Files Modified

- All `.opencode/agents/*.md` files (11 agents)
- All `.opencode/skills/*/SKILL.md` files (9 skills)
- `AGENTS.md` — Updated roster and mandatory protocol section
- `src/opencode_boomerang/assets/.opencode/agents/*.md` — Synced missing agents
- `docs/super-memory-mcp-update-spec.md` — Spec for memory updates
- Super-Memory server: `config.py`, `mcp_tools.py`, `memory.py`
- `pyproject.toml` — 0.3.0 → 0.5.0
- `.opencode/plugins/boomerang/package.json` — 0.4.0 → 0.5.0
- `.gitignore` — Added `memory_data/`

---

### 2026-04-21 — v0.3.0 Publishing & Framework Sync

**Status**: Published v0.3.0, GitHub Actions fixed, framework synced to 4 projects

#### What Was Accomplished
1. Published @veedubin/opencode-boomerang@0.3.0 to NPM
2. Fixed GitHub Actions workflows (removed PyPI, kept NPM-only)
3. Created 4 new agents: writer, scraper, init, handoff
4. Added comprehensive documentation (ROADMAP.md, docs/, examples/)
5. Updated orchestrator skill with mandatory session start protocol
6. Synced framework to 4 projects: sports-bet, proxy-hop, png2svg, resume-workspace
7. Removed misleading compactor skill
8. Added 29 integration tests for scraper (58 total tests passing)
9. Fixed .gitignore to properly track TypeScript source files

#### Key Decisions That Session
- NPM-only publishing (no PyPI)
- Plugin is the main deliverable, not Python wrapper
- Need granular NPM token with "Bypass 2FA" enabled for automation

---

## Resume Instructions

1. Read **HANDOFF.md** (this file) for session context
2. Read **AGENTS.md** for agent roster and protocol requirements
3. Read **TASKS.md** for current priorities
4. Query super-memory for detailed context about specific areas
5. Check git log for recent commits
6. If starting fresh, run `/boomerang-init` skill to initialize agents
