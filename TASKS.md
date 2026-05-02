# Boomerang Protocol Enforcement - Implementation Tasks

## Background

**v3.1.0 COMPLETE** — The Boomerang Protocol is now CODE-ENFORCED via state machine.

All 8 phases implemented:
- Phase 1: Protocol State Machine ✅
- Phase 2: Mandatory Memory Operations ✅
- Phase 3: Mandatory Sequential Thinking ✅
- Phase 4: Mandatory Planning ✅
- Phase 5: Real Agent Execution ✅
- Phase 6: Mandatory Git Check & Quality Gates ✅
- Phase 7: Documentation Tracking ✅
- Phase 8: Integration Testing ✅ (205 tests passing)

---

## Phase 1: Protocol State Machine (COMPLETE)

- [x] Create `src/protocol/state-machine.ts`
  - [x] `ProtocolStateMachine` class
  - [x] States: `IDLE` → `MEMORY_QUERY` → `SEQUENTIAL_THINK` → `PLAN` → `DELEGATE` → `GIT_CHECK` → `QUALITY_GATES` → `DOC_UPDATE` → `MEMORY_SAVE` → `COMPLETE`
  - [x] Transition validation (can only move forward if checkpoint satisfied)
  - [x] Current state tracking per session
  - [x] Event emission for state transitions

- [x] Create `src/protocol/checkpoint.ts`
  - [x] `Checkpoint` interface for each protocol step
  - [x] Validation functions for each checkpoint type:
    - [x] `validateMemoryQuery(): boolean`
    - [x] `validateSequentialThink(): boolean`
    - [x] `validatePlan(): boolean`
    - [x] `validateDelegation(): boolean`
    - [x] `validateGitCheck(): boolean`
    - [x] `validateQualityGates(): boolean`
    - [x] `validateDocUpdate(): boolean`
    - [x] `validateMemorySave(): boolean`
  - [x] Session-scoped checkpoint storage
  - [x] Checkpoint bypass detection (waiver phrases)

- [x] Create `src/protocol/types.ts` — State, event, config types
- [x] Create `src/protocol/events.ts` — Event emitter
- [x] Create `src/protocol/config.ts` — Strictness levels, waiver phrases

- [x] Rewrite `src/orchestrator.ts` to use state machine
  - [x] Replace existing protocol checks with state machine transitions
  - [x] Block on `canTransition()` until checkpoint satisfied
  - [x] Emit state change events

---

## Phase 2: Mandatory Memory Operations (COMPLETE)

- [x] Rewrite orchestrator to BLOCK until memory query completes
  - [x] Call `super-memory_query_memories` automatically if not already called
  - [x] Wait for response before proceeding to next state
  - [x] If query fails, log warning and continue (graceful degradation)
  - [x] Record checkpoint: `memoryQueryCompleted: true`

- [x] Rewrite orchestrator to BLOCK until memory save completes
  - [x] Before marking task complete, verify memory was saved
  - [x] If not saved, auto-save comprehensive summary including:
    - [x] Task description
    - [x] Decisions made
    - [x] Files changed
    - [x] Issues encountered
    - [x] Results achieved
  - [x] Record checkpoint: `memorySaveCompleted: true`

---

## Phase 3: Mandatory Sequential Thinking (COMPLETE)

- [x] Rewrite enforcer to CALL `sequential-thinking` tool
  - [x] Trigger conditions (ANY of):
    - [x] Task description > 100 characters
    - [x] Contains regex: `/implement|create|design|architecture|refactor|migration/i`
    - [x] Explicit request: "think through", "analyze", "plan this"
  - [x] Invoke `sequential-thinking_sequentialthinking` with:
    - [x] `thought`: Current understanding of the task
    - [x] `totalThoughts`: Estimated based on complexity
    - [x] `nextThoughtNeeded`: true
  - [x] Wait for tool completion (block until done)
  - [x] Include thinking output in context package
  - [x] Record checkpoint: `sequentialThinkCompleted: true`

- [x] Add complexity analysis to state machine
  - [x] Determine if task requires sequential thinking
  - [x] Skip only if waiver phrase detected AND task is simple

---

## Phase 4: Mandatory Planning (COMPLETE)

- [x] Rewrite orchestrator to REQUIRE architect review
  - [x] Trigger conditions (ANY of):
    - [x] Task contains: `/build|implement|create|coding|develop/i`
    - [x] File count > 5
    - [x] Multi-file changes
    - [x] Architecture decision required
  - [x] Delegate to `boomerang-architect` FIRST with planning request
  - [x] Block until architect returns plan
  - [x] Plan becomes task graph for delegation
  - [x] Record checkpoint: `planApproved: true`

- [x] Add waiver detection
  - [x] Phrases that bypass mandatory planning:
    - [x] "skip planning"
    - [x] "just do it"
    - [x] "no plan needed"
    - [x] "/boomerang-handoff"
  - [x] Log waiver usage for audit trail
  - [x] Simple tasks (status, handoff, single file) auto-waived

- [x] Create plan validation
  - [x] Architect's plan must include:
    - [x] Task breakdown
    - [x] File list
    - [x] Dependencies
    - [x] Error scenarios
  - [x] Reject plans that don't meet criteria

---

## Phase 5: Real Agent Execution (COMPLETE)

- [x] Create `src/execution/task-runner.ts`
  - [x] `TaskRunner` class
  - [x] Read agent definition from `agents/` directory
  - [x] Construct full prompt with context package
  - [x] Spawn agent as subprocess (real execution, not simulation)
  - [x] Wait for completion
  - [x] Parse and return results
  - [x] Handle timeout (configurable, default 5 minutes)

- [x] Create `src/execution/agent-spawner.ts`
  - [x] `AgentSpawner` class
  - [x] Spawn agent process with correct model and prompt
  - [x] Handle agent lifecycle:
    - [x] Start: spawn process with stdin/stdout pipes
    - [x] Monitor: track output, detect completion
    - [x] Cleanup: kill process on timeout or error
  - [x] Collect agent output (streaming + final)
  - [x] Handle agent errors (crash, timeout, invalid response)

- [x] Delete `simulateAgentExecution` from `src/task-executor.ts`
  - [x] Remove placeholder function
  - [x] Replace with real `TaskRunner` invocation
  - [x] Update error handling

---

## Phase 6: Mandatory Git Check & Quality Gates (COMPLETE)

- [x] Make git check BLOCK execution
  - [x] Run `git status` before making changes
  - [x] If dirty AND about to make file changes:
    - [x] Stop execution
    - [x] Warn user with specific dirty files
    - [x] Require explicit override to continue
    - [x] Override phrases: "--force", "git is fine", "proceed anyway"
  - [x] Record checkpoint: `gitCheckPassed: true`

- [x] Make quality gates BLOCK execution
  - [x] Run in sequence: `lint` → `typecheck` → `test`
  - [x] If ANY fail:
    - [x] Stop execution immediately
    - [x] Report specific failures
    - [x] Do NOT mark task complete
    - [x] Require fix before proceeding
  - [x] Bypass phrases: "skip tests", "skip gates", "--force"
  - [x] Record checkpoint: `qualityGatesPassed: true`

- [x] Add quality gate configuration
  - [x] Configurable which gates run
  - [x] Configurable failure behavior (warn vs block)
  - [x] Per-task overrides

---

## Phase 7: Documentation Tracking (COMPLETE)

- [x] Track documentation updates
  - [x] After each interaction, check if any docs changed:
    - [x] `AGENTS.md`
    - [x] `TASKS.md`
    - [x] `README.md`
    - [x] `CHANGELOG.md`
    - [x] `HANDOFF.md`
  - [x] Compare file hashes before/after
  - [x] If docs should be updated but weren't:
    - [x] Warn at handoff
    - [x] Block if critical docs missing
  - [x] Record checkpoint: `docsUpdated: true`

- [x] Add doc update enforcement at handoff
  - [x] `boomerang-handoff` skill checks doc status
  - [x] Block handoff if critical docs need updating
  - [x] Auto-populate handoff template

---

## Phase 8: Integration & Testing (COMPLETE)

- [x] Write integration tests
  - [x] `tests/protocol/state-machine.test.ts`
    - [x] Test all state transitions
    - [x] Test checkpoint validation
    - [x] Test waiver bypass
  - [x] `tests/execution/task-runner.test.ts`
    - [x] Test real agent spawning
    - [x] Test timeout handling
    - [x] Test error recovery
  - [x] `tests/protocol/enforcement.test.ts`
    - [x] Test full protocol flows
    - [x] Test each checkpoint blocks appropriately
    - [x] Test waiver phrases bypass correctly
  - [x] **205 tests passing**

- [x] Update `AGENTS.md`
  - [x] Document code-enforced behavior
  - [x] Update escape hatches (waiver phrases)
  - [x] Document new architecture
  - [x] Add Protocol Enforcement v4.0 section

- [x] Update `README.md`
  - [x] Document protocol enforcement
  - [x] Update quick start
  - [x] Add troubleshooting section

---

## File Inventory (v4.0.0)

### New Files Created

| File | Purpose |
|------|---------|
| `src/protocol/state-machine.ts` | Protocol state machine with state tracking |
| `src/protocol/checkpoint.ts` | Checkpoint validation and storage |
| `src/protocol/types.ts` | State, event, config types |
| `src/protocol/events.ts` | Event emitter for state transitions |
| `src/protocol/config.ts` | Strictness levels, waiver phrases |
| `src/execution/task-runner.ts` | Real agent execution runner |
| `src/execution/agent-spawner.ts` | Agent process spawning and lifecycle |
| `tests/protocol/state-machine.test.ts` | State machine tests |
| `tests/execution/task-runner.test.ts` | Task runner tests |
| `tests/protocol/enforcement.test.ts` | Protocol enforcement tests |

### Files Modified

| File | Changes |
|------|---------|
| `src/orchestrator.ts` | Use state machine, block on checkpoints |
| `src/task-executor.ts` | Remove simulateAgentExecution, use TaskRunner |
| `src/protocol/enforcer.ts` | Rewrite to use state machine |
| `AGENTS.md` | Add Protocol Enforcement v4.0 section |
| `README.md` | Document protocol enforcement |
| `HANDOFF.md` | Add v4.0.0 session entry |
| `CHANGELOG.md` | Add v4.0.0 entry |
| `TASKS.md` | Mark all phases complete |

### Files Deleted

| File | Reason |
|------|--------|
| `simulateAgentExecution` (in task-executor.ts) | Replaced by real TaskRunner |

---

## Strictness Levels

| Level | Behavior |
|-------|----------|
| **lenient** | Auto-fix skipped steps, warn but proceed on failures |
| **standard** | Block on mandatory steps, require explicit waiver for bypass |
| **strict** | Block on all violations, no waivers except emergencies |

Default: `standard`

---

## Breaking Changes (v4.0.0)

| Change | Impact |
|--------|--------|
| Protocol is code-enforced | Slower for simple tasks |
| Planning mandatory | Build tasks blocked without architect review |
| Sequential thinking mandatory | Complex tasks take longer |
| Real agent execution | Actual resource usage, potential for crashes |
| Git check blocks | Cannot proceed with dirty tree |
| Quality gates block | Cannot skip tests |

---

## Monitoring Tasks (Post-v4.0.0)

- [ ] Verify 205 tests pass in CI
- [ ] Monitor protocol enforcement latency in production
- [ ] Test waiver phrase bypass in real workflows
- [ ] Verify strictness level configuration works

---

*Last Updated: 2026-04-30 (v4.0.0)*

---

# Boomerang v2 Tasks

> **Strategic Context**: See [ROADMAP.md](./ROADMAP.md) for long-term vision and phase-based goals. This file is for tactical, immediate work tracking.

---

## Current Status

### v4.0.0 — Protocol Enforcement Complete (2026-04-30)

All 8 phases of protocol enforcement implemented:
- ✅ **Phase 1**: Protocol State Machine (state-machine.ts, checkpoint.ts, types.ts, events.ts, config.ts)
- ✅ **Phase 2**: Mandatory Memory Operations (auto-query, auto-save)
- ✅ **Phase 3**: Mandatory Sequential Thinking (auto-invoke for complex tasks)
- ✅ **Phase 4**: Mandatory Planning (architect review for build tasks)
- ✅ **Phase 5**: Real Agent Execution (TaskRunner, AgentSpawner replacing simulation)
- ✅ **Phase 6**: Mandatory Git Check & Quality Gates (blocking)
- ✅ **Phase 7**: Documentation Tracking (SHA-256 hash comparison)
- ✅ **Phase 8**: Integration Testing (205 tests passing)

### Session Summary (2026-04-30 — v4.0.0 Protocol Enforcement)

- ✅ **Code-enforced protocol via state machine** — All 8 steps are mandatory checkpoints
- ✅ **Real agent execution** — TaskRunner spawns actual subprocess, no more simulation
- ✅ **Strictness levels** — lenient/standard/strict configuration
- ✅ **Waiver phrases** — Escape hatches preserved for emergencies
- ✅ **Documentation tracking** — DocTracker with SHA-256 hash comparison
- ✅ **205 tests passing** — state-machine, task-runner, enforcement tests

---

## Completed Tasks ✓

### Current Session (2026-04-30) — v4.0.0 Protocol Enforcement
- [x] **Phase 1: Protocol State Machine** — state-machine.ts, checkpoint.ts, types.ts, events.ts, config.ts
- [x] **Phase 2: Mandatory Memory Operations** — auto-query on start, auto-save on complete
- [x] **Phase 3: Mandatory Sequential Thinking** — auto-invoke for complex tasks
- [x] **Phase 4: Mandatory Planning** — architect review for build tasks
- [x] **Phase 5: Real Agent Execution** — TaskRunner, AgentSpawner (replaces simulateAgentExecution)
- [x] **Phase 6: Mandatory Git Check & Quality Gates** — blocking enforcement
- [x] **Phase 7: Documentation Tracking** — DocTracker with SHA-256 hash comparison
- [x] **Phase 8: Integration Testing** — 205 tests passing
- [x] **Strictness levels** — lenient/standard/strict configuration
- [x] **Waiver phrases** — "skip planning", "skip tests", "git is fine", etc.

### Previous Session (2026-04-29) — v3.0.0 LanceDB → Qdrant Migration
- [x] Publish v2.3.13 to NPM with provenance
- [x] Fix CI tag validation for `plugin-v*.*.*` format
- [x] Create version sync verification script
- [x] Fix broken links in README (version badge, transformer URL, version mismatch)
- [x] Implement configurable LLM model selection in install-agents.js
- [x] Add --primary and --secondary args with 13 model aliases
- [x] Clean junk files from both repos
- [x] Clean docs/ directory (remove 4 old planning docs)
- [x] Remove stale @lancedb/lancedb dependency

### Previous Sessions
- [x] **v2.3.8 Release** — Agent governance fixes, grep→search_project, CI fixes
- [x] **Skill System Overhaul** — All 8 skills updated, Bug Discovery Protocol, boomerang-release skill
- [x] **index_project path parameter fix** — Super-Memory-TS bug fix
- [x] **v2.3.2 Release** — Skip integration tests in CI
- [x] **v2.3.1 Release** — MCP timeout fix, background indexing
- [x] **v2.3.0 Release** — All phases complete, CI/CD, tests
- [x] **Boomerang Init** — Customized 12 agents, created mcp-specialist

---

## Remaining Work

### Post-v4.0.0 Monitoring
- [ ] Verify 205 tests pass in CI
- [ ] Monitor protocol enforcement latency in production
- [ ] Test waiver phrase bypass in real workflows
- [ ] Verify strictness level configuration works

---

## Next Priorities

| Priority | Task | Notes |
|----------|------|-------|
| 1 | Verify v4.0.0 on NPM | Confirm plugin published with protocol enforcement |
| 2 | Monitor protocol latency | Ensure state machine doesn't slow tasks excessively |
| 3 | Test waiver phrases | Verify escape hatches work correctly |
| 4 | Verify CI passes | 205 tests must pass in GitHub Actions |
| 5 | Document migration | v3.0.0 → v4.0.0 upgrade guide if needed |

---

*Last Updated: 2026-04-30 (v4.0.0)*

---

## Post-v3.1.0 Fixes

### 2026-05-01 — Plugin Build Fix

**Problem**: CI build failed because plugin package couldn't resolve `@veedubin/super-memory-ts/dist/*` imports.

**Root Causes**:
1. Missing dependency: `@veedubin/super-memory-ts` not in plugin's package.json
2. Cross-package imports: Plugin reaching into root `src/protocol/` via relative paths

**Fixes Applied**:
- [x] Added `@veedubin/super-memory-ts` to `packages/opencode-plugin/package.json` dependencies
- [x] Reverted plugin `src/orchestrator.ts` cross-package imports (../../../protocol/)
- [x] Plugin now builds standalone: `cd packages/opencode-plugin && npm install && npm run build`

**Verification**:
- [x] Root build passes
- [x] Plugin build passes  
- [x] All 205 tests pass
- [x] Tag `plugin-v3.1.0` recreated with fix

### CI/CD Best Practices (New)

- [ ] **Test plugin standalone before tagging** — `rm -rf node_modules && npm install && npm run build`
- [ ] **Verify all package.json files have complete deps** — Don't assume root deps cover plugin
- [ ] **No cross-package imports in plugin** — Plugin must be self-contained

---

## 2026-05-01 — buildPrompt() Fix + Code Audit & Cleanup Session

### Status
**COMPLETE**. buildPrompt() fixed with 6-layer composition. Code audit cleanup done. Version bumped to v3.2.0.

### boomerang-v2 buildPrompt() Fix (v3.2.0)

- [x] **Fixed buildPrompt() in task-runner.ts**
  - [x] Changed from 4 thin layers to 6 full layers
  - [x] Layer 1: Agent systemPrompt (identity)
  - [x] Layer 2: Agent prompt (rules, style guides, escalation triggers, project context)
  - [x] Layer 3: Skill instructions (auto-loaded from `.opencode/skills/{agent}/SKILL.md`)
  - [x] Layer 4: Rich Context Package (structured ### headings for known sections)
  - [x] Layer 5: Task description
  - [x] Layer 6: Execution instructions
  - [x] Added `formatContext()` and `formatValue()` helpers
  - [x] Extended `AgentPromptLoader` with `loadSkills()` method

- [x] **Added 14 comprehensive tests** for prompt composition
  - [x] Tests cover all 6 layers, edge cases (empty context, missing skills, null values)
  - [x] All tests passing (212/212 total)

### boomerang-v2 Cleanup (v3.2.0)

- [x] **Removed unused deps**: `uuid` (use `crypto.randomUUID()`), `@types/uuid`, `@vitest/coverage-v8`
- [x] **Removed dead exports**: `resetSequentialThinker`, `resetDocTracker`
- [x] **Fixed unsafe cast** in `memory/index.ts`: replaced `(smtResults as unknown)` with `.map()`
- [x] **Fixed `getRoutingDecisions`** return type in `metrics/collector.ts`
- [x] **Consolidated `AgentDefinition`** into `protocol/types.ts`
- [x] **Created `src/utils/frontmatter.ts`**: shared YAML frontmatter parsing
- [x] **Created `src/utils/similarity.ts`**: extracted `calculateSimilarity` from `task-executor.ts`
- [x] **Migrated `protocolTracker` → `ProtocolStateMachine`** in memory-service.ts, task-executor.ts, server.ts
- [x] **Deprecated `server.ts`** with `@deprecated` JSDoc and `console.warn`
- [x] **Node 22+ required**: Added `"engines": { "node": ">=22.0.0" }` to package.json

### Quality Gates

| Project | Typecheck | Tests | Lint |
|---------|-----------|-------|------|
| boomerang-v2 | ✅ | 212/212 + 14 new ✅ | — |
| Super-Memory-TS | ✅ | 133/148 (15 skipped) ✅ | ✅ |

### Super-Memory-TS Cleanup (v2.5.0 pending)

- [x] **Removed unused devDep**: `@types/bun`
- [x] **Fixed always-false condition** in `indexer.ts:159`: `if (pattern.startsWith('/') && !pattern.startsWith('/'))` → proper logic
- [x] **Removed unused exports** from `hash.ts`, `embeddings.ts`, `memory/index.ts`, `search.ts`, `server.ts`
- [x] **Created `src/project-index/constants.ts`**: centralized ignore patterns
- [x] **Refactored `indexer.ts`, `watcher.ts`, `snapshot.ts`**: import from `constants.ts`
- [x] **Replaced `glob` with `node:fs/promises.glob`**: Node 22+ built-in
- [x] **Removed `glob` dependency**: removes ~20KB dependency

### Quality Gates

| Project | Typecheck | Tests | Lint |
|---------|-----------|-------|------|
| boomerang-v2 | ✅ | 212/212 ✅ | — |
| Super-Memory-TS | ✅ | 133/148 (15 skipped) ✅ | ✅ |

---

## Next Priorities

| Priority | Task | Notes |
|----------|------|-------|
| 1 | **Tag v3.2.0** | `git tag plugin-v3.2.0 && git push origin plugin-v3.2.0` |
| 2 | **Monitor NPM publish** | GitHub Actions triggers on tag |
| 3 | **Tag Super-Memory-TS v2.5.0** | `git tag v2.5.0 && git push origin v2.5.0` |

---

*Last Updated: 2026-05-01 (v3.2.0 buildPrompt() Fix + Release Prep)*

### Changelog Entries for Next Agent

**boomerang-v2 v3.2.0:**
```markdown
### Changed
- **Node 22+ is now required** — Added engines.node ">=22.0.0" to package.json
- **Removed `uuid` dependency** — Now uses native `crypto.randomUUID()`
- **Extracted shared utilities** — New `src/utils/frontmatter.ts` and `src/utils/similarity.ts`
- **Consolidated types** — `AgentDefinition` moved to `protocol/types.ts`
- **Migrated deprecated protocolTracker** → `ProtocolStateMachine` checkpoints

### Deprecated
- `src/server.ts` — MCP server is deprecated, use built-in integration instead

### Removed
- `uuid`, `@types/uuid`, `@vitest/coverage-v8` dependencies
- Various unused `reset*` exports
```

**Super-Memory-TS v2.5.0:**
```markdown
### Changed
- **Replaced `glob` with `node:fs/promises.glob`** — Node 22+ built-in, removes ~20KB dependency
- **Centralized ignore patterns** — New `src/project-index/constants.ts`
- **Node 22+ engine requirement** already enforced (was >=22.5.0)

### Fixed
- Fixed always-false condition in `indexer.ts` gitignore pattern parsing

### Removed
- `glob` dependency
- `@types/bun` devDependency
- Various unused exports from hash.ts, embeddings.ts, memory/search.ts
```

---

*Last Updated: 2026-05-01 (Code Audit & Cleanup)*
