# Boomerang v2 Tasks

> **Strategic Context**: See [ROADMAP.md](./ROADMAP.md) for long-term vision and phase-based goals. This file is for tactical, immediate work tracking.

---

## Current Status

### Session Summary (2026-04-27 — Skill Updates & Super-Memory-TS Fixes)

- ✅ **Fixed index_project path parameter** — Added getRootPath/setRootPath to indexer, tests added
- ⚠️ **prebuild-install deprecation** — Added sharp override, blocked by @xenova/transformers
- ✅ **Updated all 8 agent skill files** — Fixed MCP tool names per new schema
- ✅ **Added Bug Discovery Protocol** to explorer skill
- ✅ **Created boomerang-release skill** — 5-step release workflow
- ✅ **Enhanced boomerang-writer skill** — Documentation maintenance standards
- ⏳ Next: Verify all fixes in production after OpenCode restart

---

## Completed Tasks ✓

### Current Session (2026-04-27)
- [x] Fix index_project path parameter (Super-Memory-TS)
- [x] Address prebuild-install deprecation warning (sharp override)
- [x] Update all 8 agent skill files with correct MCP tool names
- [x] Add mandatory Super-Memory Protocol to all skills
- [x] Add Bug Discovery Protocol to explorer skill
- [x] Create boomerang-release skill (5-step workflow)
- [x] Enhance boomerang-writer with Documentation Maintenance

### Previous Sessions
- [x] **Fix MCP 'Not connected'** — Connection issue fix in v2.2.1
- [x] **Fix projectId loss in MCP tool responses** — Super-Memory-TS
- [x] **Fix Qdrant filter format** — array → object in with_filter
- [x] **Release v2.2.1 to NPM**
- [x] **Boomerang Init** — Customized 12 agents, created mcp-specialist
- [x] **v2.1.6 Architectural Recovery** — Built-in integration, protocol enforcement, metrics, routing
- [x] **MCP-Only Memory Migration** — Converted from dual-path to MCP-only dependency
- [x] **v1.1.0 Release** — Tool name fixes, integration tests, CI/CD

---

## Remaining Work

### Testing & Integration
- [ ] Verify MCP tools work after OpenCode restart
- [ ] Test project isolation with Super-Memory-TS v2.2.1
- [ ] Collect metrics samples (need 5+ for intelligent routing)

### Future Considerations
- [ ] Resolve prebuild-install deprecation (blocked by @xenova/transformers)
- [ ] Push to GitHub and verify CI passes

---

## Next Priorities

| Priority | Task | Notes |
|----------|------|-------|
| 1 | Verify MCP tools work after restart | Test query_memories, add_memory, search_project, index_project |
| 2 | Test project isolation | Verify v2.2.1 works correctly per-project |
| 3 | Collect routing metrics | 5+ samples needed for intelligent routing |
| 4 | Push to GitHub | Verify CI passes |

---

*Last Updated: 2026-04-27*
