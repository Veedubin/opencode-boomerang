# Boomerang v4.0.0 Tasks

> **Strategic Context**: Boomerang v4.0.0 is a hard refactor from v3.2.0. The orchestrator is now a pure decision layer, OpenCode handles execution, and the protocol is advisory only.
> **DO NOT TAG OR RELEASE YET** - There are remaining items to complete before v4.0.0 is ready for publish.

---

## Current Status

### v4.0.0 - Hard Refactor + Permission Fixes Complete (2026-05-03)

| Component | Status | Notes |
|-----------|--------|-------|
| Orchestrator | ✅ Pure decision layer | Returns {agent, systemPrompt, contextPackage, suggestions} |
| OpenCode Execution | ✅ Native | Boomerang no longer spawns subprocesses |
| ProtocolAdvisor | ✅ Advisory only | Logs suggestions, never blocks |
| Memory Integration | ✅ Direct | Super-Memory-TS via src/memory/index.ts |
| Prompt Composition | ✅ 6-layer | buildPrompt() works correctly |
| Tests | ✅ 155/155 | All passing after refactor |
| Agent Permissions | ✅ Fixed | Orchestrator can read all files + edit with approval |
| Plugin Package | ✅ Refactored | Builds standalone, v4.0.0, no cross-package imports |
| Versions Synced | ✅ 4.0.0 | Root, plugin, src/index.ts all match |

### Deleted Components (24 files total)

**Root (11):**
- src/execution/agent-spawner.ts - Fake simulation
- src/task-executor.ts - Duplicate execution logic
- src/routing/scoring-router.ts - Broken metrics query
- src/context/monitor.ts - Naive heuristic
- src/context/compactor.ts - No real compaction
- src/middleware/pipeline.ts - Never used
- src/protocol/tracker.ts - Deprecated
- src/execution/sequential-thinker.ts - globalThis.mcp never true
- src/server.ts - Deprecated MCP server
- src/memory-service.ts - Direct integration instead
- src/utils/frontmatter.ts - Inline in asset-loader

**Plugin (13):**
- task-executor.ts, memory-client.ts, memory-engine.ts
- native-memory.ts, built-in-memory.ts, middleware.ts
- lazy-compaction.ts, session-state.ts, agent-state.ts
- task-state.ts, context-isolation.ts, task-parser.ts
- project-index-manager.ts

---

## Completed Tasks ✓

### v4.0.0 Hard Refactor (2026-05-03)
- [x] Delete 11 dead files from root
- [x] Delete 13 dead files from plugin package
- [x] Rewrite orchestrator as pure decision layer
- [x] Rewrite ProtocolEnforcer → ProtocolAdvisor (advisory)
- [x] Rewrite TaskRunner as prompt builder only
- [x] Update plugin interface (index.ts) for both root and plugin
- [x] Delete 6 test files referencing deleted components
- [x] Rewrite orchestrator tests for new API (17 new tests)
- [x] Verify 155/155 tests passing
- [x] Update all documentation (README, ARCHITECTURE, AGENTS, CHANGELOG)
- [x] Update HANDOFF.md with v4.0.0 session entry
- [x] Fix agent permissions (11 agents updated)
- [x] Sync agents to .opencode/agents/
- [x] Verify plugin builds standalone
- [x] Sync versions to 4.0.0 across all files

---

## Completed in This Session (2026-05-03)

### P0 - Must Complete Before Tagging ✅ ALL DONE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | **Update Plugin README** | ✅ Done | Rewrote for v4.0.0 reality. Removed v3.1.0 badge, fake features, blocking protocol claims. Added Plugin API Usage section. |
| 2 | **Update Skills for v4.0.0** | ✅ Done | Skills were already v4.0.0-ready (no v3.x references found in content) |
| 3 | **Sync Skills to .opencode** | ✅ Done | Copied missing `mcp-specialist` and `researcher` skills. `.opencode/skills/` now has all 14 skills |
| 4 | **Clean LanceDB References** | ✅ Done | Fixed 1 reference: `src/memory/schema.ts` line 2 (LanceDB → Qdrant) |
| 5 | **Add Plugin Tests** | ✅ Done | Created `packages/opencode-plugin/tests/index.test.ts` with 34 tests covering exports, orchestrator, asset loader, git, memory, build verification |

### P1 - Should Complete Before Release ✅ ALL DONE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6 | **Verify Root package.json deps** | ✅ Done | All deps verified used: `@modelcontextprotocol/sdk`, `@veedubin/super-memory-ts`, `zod` (deps); `@types/node`, `tsx`, `typescript`, `vitest` (devDeps) |
| 7 | **Update Plugin package.json desc** | ✅ Done | Updated to: "Intelligent routing and context building plugin for OpenCode. Provides multi-agent orchestration with rich Context Packages." |
| 8 | **Clean stale comments** | ✅ Done | Fixed `src/protocol/config.ts` line 42 ("allows blocking" → "is configured (advisory only, never blocks in v4.0.0)") |
| 9 | **Verify CI workflows** | ✅ Done | CI workflows are correct. `test-plugin` job now has tests to run (34 plugin tests) |

### P2 - Can Wait But Nice to Have

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | **Integration test** | ✅ Done | Created `packages/opencode-plugin/tests/integration.test.ts` with 46 tests covering full orchestrator flow, Context Package completeness, end-to-end scenarios |
| 11 | **Plugin README examples** | ✅ Done | Included in README rewrite (Plugin API Usage section) |
| 12 | **Migration guide** | ✅ Done | Expanded CHANGELOG.md v4.0.0 section with comprehensive 6-part migration guide (Overview, Breaking Changes, Action Items, API Changes, No-Action Items, Rollback Notes) |

---

## Next Agent Instructions

**START WITH:**
1. Read this TASKS.md fully
2. Read HANDOFF.md for session context
3. Query super-memory for v4.0.0 context
4. Start with P0 item #1 (Plugin README)

**PRIORITY ORDER:**
1. P0 items first (1-5) - these block release
2. P1 items second (6-9) - polish
3. P2 items last (10-12) - nice to have

**READY TO RELEASE:**
- All 12 items complete
- Quality gates pass (Root 155/155, Plugin 80/80)
- Tag: `git tag plugin-v4.0.0 && git push origin plugin-v4.0.0`
- Monitor NPM publish after tag push

**WHEN DONE:**
- Update this TASKS.md marking items complete
- Update HANDOFF.md with session summary
- Report remaining items to user
- Ask if ready to commit and hold, or continue

---

## What v4.0.0 Actually Does

1. Orchestrator analyzes request, queries memory, detects task type
2. Selects agent via keyword routing
3. Builds Context Package with 6-layer prompt composition
4. Returns {agent, systemPrompt, contextPackage, suggestions}
5. OpenCode executes the agent natively
6. ProtocolAdvisor logs warnings but never blocks

## What v4.0.0 Does NOT Do

- No subprocess spawning
- No blocking protocol enforcement
- No context monitoring/compaction
- No scoring router
- No middleware pipeline
- No MCP server
- No LanceDB (Qdrant only)

---

*Last Updated: 2026-05-03*
*Status: ALL 12 ITEMS COMPLETE — v4.0.0 READY FOR RELEASE*
*Quality Gates: Root 155/155 ✅ | Plugin 80/80 ✅ | Build ✅ | Typecheck ✅*
*Next Action: Final verification, then tag `plugin-v4.0.0` and push to GitHub*
