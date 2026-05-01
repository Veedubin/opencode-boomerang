# Boomerang Protocol Enforcement - Implementation Tasks

## Background

The current boomerang-v2 has "simulated" protocol enforcement. The orchestrator, enforcer, and task executor infrastructure exists but:
- Sequential thinking is never actually called (only warns)
- Planning is not enforced (no code checks)
- Agent execution is fake (simulateAgentExecution returns a string)
- Documentation updates are not tracked
- Only git check and quality gates actually run

This plan makes the protocol CODE-ENFORCED.

---

## Phase 1: Protocol State Machine (Foundation)

- [ ] Create `src/protocol/state-machine.ts`
  - `ProtocolStateMachine` class
  - States: `IDLE` → `MEMORY_QUERY` → `SEQUENTIAL_THINK` → `PLAN` → `DELEGATE` → `GIT_CHECK` → `QUALITY_GATES` → `DOC_UPDATE` → `MEMORY_SAVE` → `COMPLETE`
  - Transition validation (can only move forward if checkpoint satisfied)
  - Current state tracking per session
  - Event emission for state transitions

- [ ] Create `src/protocol/checkpoint.ts`
  - `Checkpoint` interface for each protocol step
  - Validation functions for each checkpoint type:
    - `validateMemoryQuery(): boolean`
    - `validateSequentialThink(): boolean`
    - `validatePlan(): boolean`
    - `validateDelegation(): boolean`
    - `validateGitCheck(): boolean`
    - `validateQualityGates(): boolean`
    - `validateDocUpdate(): boolean`
    - `validateMemorySave(): boolean`
  - Session-scoped checkpoint storage
  - Checkpoint bypass detection (waiver phrases)

- [ ] Rewrite `src/orchestrator.ts` to use state machine
  - Replace existing protocol checks with state machine transitions
  - Block on `canTransition()` until checkpoint satisfied
  - Emit state change events

---

## Phase 2: Mandatory Memory Operations

- [ ] Rewrite orchestrator to BLOCK until memory query completes
  - Call `super-memory_query_memories` automatically if not already called
  - Wait for response before proceeding to next state
  - If query fails, log warning and continue (graceful degradation)
  - Record checkpoint: `memoryQueryCompleted: true`

- [ ] Rewrite orchestrator to BLOCK until memory save completes
  - Before marking task complete, verify memory was saved
  - If not saved, auto-save comprehensive summary including:
    - Task description
    - Decisions made
    - Files changed
    - Issues encountered
    - Results achieved
  - Record checkpoint: `memorySaveCompleted: true`

---

## Phase 3: Mandatory Sequential Thinking

- [ ] Rewrite enforcer to CALL `sequential-thinking` tool
  - Trigger conditions (ANY of):
    - Task description > 100 characters
    - Contains regex: `/implement|create|design|architecture|refactor|migration/i`
    - Explicit request: "think through", "analyze", "plan this"
  - Invoke `sequential-thinking_sequentialthinking` with:
    - `thought`: Current understanding of the task
    - `totalThoughts`: Estimated based on complexity
    - `nextThoughtNeeded`: true
  - Wait for tool completion (block until done)
  - Include thinking output in context package
  - Record checkpoint: `sequentialThinkCompleted: true`

- [ ] Add complexity analysis to state machine
  - Determine if task requires sequential thinking
  - Skip only if waiver phrase detected AND task is simple

---

## Phase 4: Mandatory Planning

- [ ] Rewrite orchestrator to REQUIRE architect review
  - Trigger conditions (ANY of):
    - Task contains: `/build|implement|create|coding|develop/i`
    - File count > 5
    - Multi-file changes
    - Architecture decision required
  - Delegate to `boomerang-architect` FIRST with planning request
  - Block until architect returns plan
  - Plan becomes task graph for delegation
  - Record checkpoint: `planApproved: true`

- [ ] Add waiver detection
  - Phrases that bypass mandatory planning:
    - "skip planning"
    - "just do it"
    - "no plan needed"
    - "/boomerang-handoff"
  - Log waiver usage for audit trail
  - Simple tasks (status, handoff, single file) auto-waived

- [ ] Create plan validation
  - Architect's plan must include:
    - Task breakdown
    - File list
    - Dependencies
    - Error scenarios
  - Reject plans that don't meet criteria

---

## Phase 5: Real Agent Execution

- [ ] Create `src/execution/task-runner.ts`
  - `TaskRunner` class
  - Read agent definition from `agents/` directory
  - Construct full prompt with context package
  - Spawn agent as subprocess (real execution, not simulation)
  - Wait for completion
  - Parse and return results
  - Handle timeout (configurable, default 5 minutes)

- [ ] Create `src/execution/agent-spawner.ts`
  - `AgentSpawner` class
  - Spawn agent process with correct model and prompt
  - Handle agent lifecycle:
    - Start: spawn process with stdin/stdout pipes
    - Monitor: track output, detect completion
    - Cleanup: kill process on timeout or error
  - Collect agent output (streaming + final)
  - Handle agent errors (crash, timeout, invalid response)

- [ ] Delete `simulateAgentExecution` from `src/task-executor.ts`
  - Remove placeholder function
  - Replace with real `TaskRunner` invocation
  - Update error handling

---

## Phase 6: Mandatory Git Check & Quality Gates

- [ ] Make git check BLOCK execution
  - Run `git status` before making changes
  - If dirty AND about to make file changes:
    - Stop execution
    - Warn user with specific dirty files
    - Require explicit override to continue
    - Override phrases: "--force", "git is fine", "proceed anyway"
  - Record checkpoint: `gitCheckPassed: true`

- [ ] Make quality gates BLOCK execution
  - Run in sequence: `lint` → `typecheck` → `test`
  - If ANY fail:
    - Stop execution immediately
    - Report specific failures
    - Do NOT mark task complete
    - Require fix before proceeding
  - Bypass phrases: "skip tests", "skip gates", "--force"
  - Record checkpoint: `qualityGatesPassed: true`

- [ ] Add quality gate configuration
  - Configurable which gates run
  - Configurable failure behavior (warn vs block)
  - Per-task overrides

---

## Phase 7: Documentation Tracking

- [ ] Track documentation updates
  - After each interaction, check if any docs changed:
    - `AGENTS.md`
    - `TASKS.md`
    - `README.md`
    - `CHANGELOG.md`
    - `HANDOFF.md`
  - Compare file hashes before/after
  - If docs should be updated but weren't:
    - Warn at handoff
    - Block if critical docs missing
  - Record checkpoint: `docsUpdated: true`

- [ ] Add doc update enforcement at handoff
  - `boomerang-handoff` skill checks doc status
  - Block handoff if critical docs need updating
  - Auto-populate handoff template

---

## Phase 8: Integration & Testing

- [ ] Write integration tests
  - `tests/protocol/state-machine.test.ts`
    - Test all state transitions
    - Test checkpoint validation
    - Test waiver bypass
  - `tests/execution/task-runner.test.ts`
    - Test real agent spawning
    - Test timeout handling
    - Test error recovery
  - `tests/protocol/enforcement.test.ts`
    - Test full protocol flows
    - Test each checkpoint blocks appropriately
    - Test waiver phrases bypass correctly

- [ ] Update `AGENTS.md`
  - Document code-enforced behavior
  - Update escape hatches (waiver phrases)
  - Document new architecture
  - Add Protocol Enforcement v4.0 section

- [ ] Update `README.md`
  - Document protocol enforcement
  - Update quick start
  - Add troubleshooting section

---

## File Inventory

### New Files to Create

| File | Purpose |
|------|---------|
| `src/protocol/state-machine.ts` | Protocol state machine with state tracking |
| `src/protocol/checkpoint.ts` | Checkpoint validation and storage |
| `src/execution/task-runner.ts` | Real agent execution runner |
| `src/execution/agent-spawner.ts` | Agent process spawning and lifecycle |
| `tests/protocol/state-machine.test.ts` | State machine tests |
| `tests/execution/task-runner.test.ts` | Task runner tests |
| `tests/protocol/enforcement.test.ts` | Protocol enforcement tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/orchestrator.ts` | Use state machine, block on checkpoints |
| `src/task-executor.ts` | Remove simulateAgentExecution, use TaskRunner |
| `src/protocol/enforcer.ts` | Rewrite to use state machine |
| `src/index.ts` | Update entry point if needed |
| `AGENTS.md` | Add Protocol Enforcement v4.0 section |
| `README.md` | Document protocol enforcement |
| `HANDOFF.md` | Add this initiative |

### Files to Delete

| File | Reason |
|------|--------|
| `simulateAgentExecution` (in task-executor.ts) | Replaced by real TaskRunner |

---

## Implementation Order

1. **Phase 1** (State Machine) - Foundation, do first
2. **Phase 2** (Memory Operations) - Uses state machine
3. **Phase 3** (Sequential Thinking) - Uses state machine
4. **Phase 4** (Planning) - Uses state machine, architect delegation
5. **Phase 5** (Real Execution) - Independent, can parallelize
6. **Phase 6** (Git/Quality Gates) - Uses state machine
7. **Phase 7** (Doc Tracking) - Uses state machine
8. **Phase 8** (Testing) - Do last

---

## Breaking Changes

| Change | Impact |
|--------|--------|
| Orchestrator stricter | Slower for simple tasks |
| Planning mandatory | Build tasks blocked without plan |
| Sequential thinking mandatory | Complex tasks take longer |
| Real agent execution | Actual resource usage, potential for crashes |
| Git check blocks | Cannot proceed with dirty tree |
| Quality gates block | Cannot skip tests |

---

## Backward Compatibility

- Waiver phrases preserve escape hatches
- `--force` flag available for emergencies
- Configuration options for strictness level
- Gradual rollout possible (opt-in via config)

---

*Last Updated: 2026-04-30*

---

# Boomerang v2 Tasks

> **Strategic Context**: See [ROADMAP.md](./ROADMAP.md) for long-term vision and phase-based goals. This file is for tactical, immediate work tracking.

---

## Current Status

### Session Summary (2026-04-29 — v3.0.0 → v3.0.1 LanceDB → Qdrant Migration + Super-Memory-TS v2.3.7)

- ✅ **Published Super-Memory-TS v2.3.7** — Connection resilience fixes (start MCP transport even when Qdrant down, retry logic, get_status tool)
- ✅ **Published boomerang-v2 v3.0.0 → v3.0.1** — Major breaking migration from LanceDB to Qdrant/Super-Memory-TS
- ✅ **Created memory adapter layer** — `src/memory/adapter.ts` with full type conversion between boomerang-v2 and Super-Memory-TS formats
- ✅ **Deleted 15 LanceDB files** — database.ts, operations.ts, search.ts, text-search.ts, model/, project-index/ (LanceDB-specific)
- ✅ **Created migration script** — `scripts/migrate-lancedb-to-qdrant.ts` for data migration from LanceDB to Qdrant
- ✅ **Created Qdrant container manager** — `scripts/qdrant-manager.ts` for Docker container lifecycle management
- ✅ **Created cleanup script** — `scripts/cleanup-qdrant-containers.ts` for removing stale containers
- ✅ **Created docker-compose.yml** — Named container, auto-restart, health checks, persistent storage
- ✅ **Added 58 adapter tests** — `src/memory/adapter.test.ts` (38) + `src/memory/index.test.ts` (20), all passing
- ✅ **Updated docs** — README.md, CHANGELOG.md, AGENTS.md all updated for v3.0.0
- ✅ **Fixed LanceDB table discovery** — Actual table is "memories", not "memory_entries"

---

## Completed Tasks ✓

### Current Session (2026-04-29) — v3.0.0 LanceDB → Qdrant Migration
- [x] **Migrate boomerang-v2 from LanceDB to Qdrant** — BREAKING v3.0.0
  - [x] Create memory adapter layer (`src/memory/adapter.ts`, `src/memory/index.ts`)
  - [x] Delete 15 LanceDB-specific files (database.ts, operations.ts, search.ts, text-search.ts, model/, project-index/)
  - [x] Update MemorySystem to wrap Super-Memory-TS Qdrant implementation
  - [x] Add project isolation via `BOOMERANG_PROJECT_ID`
  - [x] Add connection resilience with exponential backoff retry
- [x] **Create migration tooling**
  - [x] `scripts/migrate-lancedb-to-qdrant.ts` — Data ingest from LanceDB to Qdrant
  - [x] `scripts/qdrant-manager.ts` — Docker container lifecycle management
  - [x] `scripts/cleanup-qdrant-containers.ts` — Remove stale containers
  - [x] `docker-compose.yml` — Named container, auto-restart, health checks
- [x] **Add 58 adapter tests** — `adapter.test.ts` (38) + `index.test.ts` (20), all passing
- [x] **Update documentation** — README.md, CHANGELOG.md, AGENTS.md for v3.0.0
- [x] **Fix LanceDB table discovery** — Actual table is "memories", not "memory_entries"
- [x] **Publish Super-Memory-TS v2.3.7** — Connection resilience (start when Qdrant down, retry, get_status)
- [x] **Bump boomerang-v2 to v3.0.1** — Patch for any post-migration fixes
- [x] **Fix build errors** — Removed `.js` extensions from node_modules imports, fixed implicit `any` types
- [x] **Fix version sync** — `packages/opencode-plugin/package.json` was out of sync with root
- [x] **Remove stale dependencies** — Deleted `@lancedb/lancedb` devDependency and vitest config refs
- [x] **Delete dead TUI code** — Removed 21 unused TUI files (pre-existing dead code)

### Previous Session (2026-04-28)
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

### Post-Migration Monitoring
- [ ] Verify v3.0.0 published correctly on NPM
- [ ] Test migration script with real LanceDB data
- [ ] Monitor Qdrant connection stability in production

### Future Considerations
- [ ] Evaluate dropping remaining LanceDB references completely
- [ ] Consider adding migration progress indicator for large datasets
- [ ] Document v3.0.0 breaking changes for users upgrading from v2.x

---

## Next Priorities

| Priority | Task | Notes |
|----------|------|-------|
| 1 | Verify v3.0.0 on NPM | Confirm plugin published with Qdrant migration |
| 2 | Test migration script | Run `npm run migrate-memory` with sample LanceDB data |
| 3 | End-to-end test | Verify memory operations work through full pipeline |
| 4 | Update Super-Memory-TS AGENTS.md | Version still shows v2.2.2, should be v2.3.7 |
| 5 | Monitor TUI errors | Pre-existing errors in tui.test.ts need investigation |

---

*Last Updated: 2026-04-30*
