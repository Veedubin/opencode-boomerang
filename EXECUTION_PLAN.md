# Boomerang-v2 Critical Fixes — Execution Plan

> **Version**: 1.0.0  
> **Created**: 2026-04-25  
> **Scope**: 8 critical fixes for production readiness  
> **Estimated Total Effort**: 22–32 engineering hours

---

## Executive Summary

This plan details the execution of 8 critical fixes needed to make boomerang-v2 production-ready. Each fix includes: dependencies, files to modify, implementation notes, test requirements, and estimated effort.

**Key Decision**: All 8 fixes can run in parallel across multiple coder agents with carefully defined file boundaries. The only files touched by multiple fixes have orthogonal changes in different locations.

---

## 1. Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIX DEPENDENCIES                                │
└─────────────────────────────────────────────────────────────────────────────┘

Fix 1 (Protocol Tracker) ──────┐
                               │
Fix 2 (Integration Tests) ─────┤
                               │
Fix 3 (Context Monitor) ───────┤
                               ├──► ALL INDEPENDENT — CAN RUN IN PARALLEL
Fix 4 (Plugin Sync) ───────────┤
                               │
Fix 5 (Standalone Docs) ───────┤
                               │
Fix 6 (Agent Prompts) ─────────┤
                               │
Fix 7 (Metrics Dashboard) ─────┤
                               │
Fix 8 (Graceful Degradation) ──┘

CONFLICT MAP (same files touched):
├── src/memory-service.ts      → Fix 1 (method tracking) + Fix 8 (initialize fallback)
├── src/task-executor.ts       → Fix 1 (tracking hooks) + Fix 3 (token estimation)
├── src/orchestrator.ts        → Fix 3 (monitor calls) + Fix 8 (error handling)
├── packages/opencode-plugin/src/index.ts → Fix 4 (memory tools) + Fix 7 (metrics tool)
└── NOTE: All conflicts are LOCATION-SEPARATE. See per-fix "Edit Boundaries" below.
```

---

## 2. Execution Order

### Phase 1: Parallel Execution (All 8 Fixes Simultaneously)

| Fix | Agent Assignment | Estimated Hours |
|-----|-----------------|-----------------|
| Fix 1 — Protocol Tracker | Coder A | 2–3 |
| Fix 2 — Integration Tests | Coder B | 4–6 |
| Fix 3 — Context Monitor | Coder C | 2–3 |
| Fix 4 — Plugin Sync | Coder D | 3–5 |
| Fix 5 — Standalone Docs | Coder E | 1–2 |
| Fix 6 — Agent Prompts | Coder F | 3–4 |
| Fix 7 — Metrics Dashboard | Coder G | 4–5 |
| Fix 8 — Graceful Degradation | Coder H | 3–4 |

**Parallelization Rules:**
1. Each coder works on their assigned files (see Section 4)
2. For shared files, use the **Edit Boundaries** specified in each fix to avoid merge conflicts
3. Run `npm run typecheck` and `npm test -- --run` after each fix
4. If merge conflicts occur, Fix 8 takes priority on `src/memory-service.ts`, Fix 1 takes priority on `src/task-executor.ts`

---

## 3. Detailed Implementation Notes

---

### Fix 1: Wire Protocol Tracker to Actual Tool Calls

**Problem**: `protocolTracker.recordToolCall()` exists in `src/protocol/tracker.ts` but is only called from the auto-fix paths in `src/protocol/enforcer.ts`. Real agent tool usage is invisible to compliance tracking.

**Solution**: Inject tracking calls at every tool execution boundary.

**Architecture Decision**: Use a two-tier tracking approach:
1. **MCP Tool Layer**: Track at the server handler level (`src/server.ts`)
2. **Internal API Layer**: Track at the `MemoryService` method level (`src/memory-service.ts`)
3. **Task Execution Layer**: Track agent invocation at the task executor level (`src/task-executor.ts`)

**Edit Boundaries** (to avoid conflicts with Fix 3 and Fix 8):

In `src/task-executor.ts` — **Fix 1 owns lines around the middleware execution block**:
```typescript
// FIX 1 INSERTION POINT (before line ~349):
// After: const ctx: MiddlewareContext = { ... };
// Add: protocolTracker.recordToolCall(sessionId, `agent:${task.agent}`, { taskId: task.id, type: task.type });
```

In `src/memory-service.ts` — **Fix 1 owns the operational methods, NOT `initialize()`**:
- `queryMemories()` — add tracking at line ~42
- `addMemory()` — add tracking at line ~56
- `searchProject()` — add tracking at line ~74
- `indexProject()` — add tracking at line ~85

**Files to Modify:**

| File | Change Type | Lines |
|------|------------|-------|
| `src/server.ts` | Add tracking to 4 handlers | ~118-126, ~183-220, ~226-258, ~263-294 |
| `src/memory-service.ts` | Add tracking to 4 methods | ~41-42, ~56-57, ~74-75, ~85-86 |
| `src/task-executor.ts` | Add tracking in `executeSingle()` | ~348-350 |
| `src/protocol/tracker.ts` | Add `recordMemoryQuery()` helper | New method after line ~60 |

**Implementation Steps:**

1. In `src/server.ts`, at the top of each handler function, add:
   ```typescript
   protocolTracker.recordToolCall('mcp-session', name, args);
   ```

2. In `src/memory-service.ts`, import `protocolTracker` and add at the start of each public method:
   ```typescript
   protocolTracker.recordToolCall('internal', 'memory.queryMemories', { query, options });
   ```
   (Use a consistent sessionId strategy — `'internal'` or pass through from caller)

3. In `src/task-executor.ts`, import `protocolTracker` and add before middleware execution:
   ```typescript
   protocolTracker.recordToolCall(sessionId, `agent:${task.agent}`, {
     taskId: task.id,
     taskType: task.type,
     description: task.description.slice(0, 100),
   });
   ```

4. In `src/protocol/tracker.ts`, add a helper for internal calls:
   ```typescript
   recordInternalToolCall(toolName: string, args: Record<string, unknown>) {
     // Use 'system' as sessionId for internal operations
     this.recordToolCall('system', toolName, args);
   }
   ```

**Test Requirements:**
- Add unit test in `tests/protocol/tracker.test.ts` (create if missing):
  - Verify `recordToolCall()` increments toolCalls array
  - Verify checkpoint flags are set correctly for memory operations
  - Verify internal vs MCP tool calls are both tracked

**Acceptance Criteria:**
- [ ] `protocolTracker.getCheckpoints(sessionId).memoryQueried` is `true` after any memory query
- [ ] `protocolTracker.getCheckpoints(sessionId).memorySaved` is `true` after any memory add
- [ ] All 4 MCP tools in `src/server.ts` record their calls
- [ ] All 4 MemoryService methods record their calls
- [ ] Task execution records agent invocations

---

### Fix 2: Real Integration Tests

**Problem**: Tests in `tests/integration/` mock `getMemorySystem()` via `vi.mock()`. They verify mock interactions, not the actual MemoryService → MemorySystem → LanceDB chain.

**Solution**: Create integration tests using real `memory://` LanceDB instances with minimal mocking (only model embeddings).

**Architecture Decision**: Use a **test pyramid** approach:
- Mock ONLY the embedding model (`src/model/index.js`) — loading real ML models in tests is slow
- Use REAL LanceDB connections (`memory://` URI)
- Use REAL memory operations (`src/memory/operations.ts`)
- Use REAL project indexing (`src/project-index/indexer.ts`)

**Files to Modify:**

| File | Change Type | Purpose |
|------|------------|---------|
| `tests/integration/real-memory.test.ts` | **NEW** | addMemory → queryMemories roundtrip |
| `tests/integration/real-project-index.test.ts` | **NEW** | indexProject → searchProject roundtrip |
| `vitest.config.ts` | Modify | Add `testTimeout: 30000` for integration tests |

**Implementation Steps:**

1. **Create `tests/integration/real-memory.test.ts`**:
   ```typescript
   import { describe, test, expect, beforeEach, afterEach } from 'vitest';
   import { getMemorySystem } from '../../src/memory/index.js';
   import { lancedbPool } from '../../src/memory/database.js';
   
   describe('Real Memory Integration', () => {
     beforeEach(async () => {
       await lancedbPool.connect('memory://real-test');
     });
     
     afterEach(async () => {
       await lancedbPool.closeAll();
     });
     
     test('addMemory → queryMemories returns the added memory', async () => {
       const memorySystem = getMemorySystem();
       // Note: MemorySystem is singleton and may already be initialized
       if (!memorySystem.isInitialized()) {
         await memorySystem.initialize('memory://real-test');
       }
       
       // Add a memory
       const added = await memorySystem.addMemory({
         text: 'Integration test memory about database schemas',
         sourceType: 'manual',
         sourcePath: '/test/integration',
         sessionId: 'test-session',
         metadataJson: '{}',
       });
       
       expect(added.id).toBeDefined();
       
       // Query for it
       const results = await memorySystem.search('database schemas', {
         topK: 5,
         threshold: 0.1, // Low threshold for test reliability
       });
       
       expect(results.length).toBeGreaterThan(0);
       expect(results[0].entry.text).toBe('Integration test memory about database schemas');
     });
   });
   ```

2. **Create `tests/integration/real-project-index.test.ts`**:
   ```typescript
   import { describe, test, expect, beforeEach, afterEach } from 'vitest';
   import { tmpdir } from 'os';
   import { join } from 'path';
   import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
   import { ProjectIndexer } from '../../src/project-index/indexer.js';
   import { searchProject } from '../../src/project-index/search.js';
   import { lancedbPool } from '../../src/memory/database.js';
   
   describe('Real Project Index Integration', () => {
     let testDir: string;
     let dbUri: string;
     
     beforeEach(async () => {
       testDir = join(tmpdir(), `boomerang-index-test-${Date.now()}`);
       mkdirSync(testDir, { recursive: true });
       dbUri = `memory://project-test-${Date.now()}`;
       await lancedbPool.connect(dbUri);
     });
     
     afterEach(async () => {
       if (existsSync(testDir)) {
         rmSync(testDir, { recursive: true, force: true });
       }
       await lancedbPool.closeAll();
     });
     
     test('indexProject → searchProject finds indexed files', async () => {
       // Create a test file
       const testFile = join(testDir, 'utils.ts');
       writeFileSync(testFile, `
         export function calculateTotal(items: number[]): number {
           return items.reduce((sum, item) => sum + item, 0);
         }
       `);
       
       // Index the project
       const indexer = new ProjectIndexer(dbUri, testDir);
       await indexer.start();
       await indexer.indexFile(testFile);
       
       expect(indexer.getStats().totalFiles).toBe(1);
       expect(indexer.getStats().totalChunks).toBeGreaterThan(0);
       
       // Search for the content
       const results = await searchProject('calculate total sum', 10);
       
       expect(results.length).toBeGreaterThan(0);
       expect(results[0].content).toContain('calculateTotal');
       
       await indexer.stop();
     });
   });
   ```

3. **Update `vitest.config.ts`**:
   ```typescript
   export default defineConfig({
     test: {
       testTimeout: 30000, // Integration tests need more time
       pool: 'threads',
       // ... existing config
     },
   });
   ```

**Important Notes:**
- The `memory://` URI creates an in-memory LanceDB that persists for the connection lifetime
- `lancedbPool.closeAll()` must be called in `afterEach` to reset state
- Model manager mocking may still be needed if `transformers.js` models don't load in CI
- If tests fail due to model loading, mock ONLY `src/model/index.js` and keep everything else real

**Test Requirements:**
- [ ] `npm test -- tests/integration/real-memory.test.ts` passes
- [ ] `npm test -- tests/integration/real-project-index.test.ts` passes
- [ ] Tests verify actual data flow, not mock call counts

**Acceptance Criteria:**
- [ ] Real integration tests exist and pass
- [ ] Tests use actual LanceDB (memory://) without mocking the database layer
- [ ] Tests verify end-to-end data integrity (add → search returns correct content)

---

### Fix 3: Context Monitor Token Source

**Problem**: `contextMonitor.updateUsage(tokens)` exists but nothing calls it with actual token counts. The context thresholds (40% compact, 80% handoff) never trigger.

**Solution**: Implement a text-length-based token estimator called after each agent response and planning operation. Document that it's estimation-based.

**Architecture Decision**: 
- **No OpenCode API hook available** — the plugin SDK doesn't expose token usage events
- **Use text-length estimation** as the practical fallback
- Average English token ratio: ~4 characters per token (conservative estimate)
- Update monitoring after: task planning, agent response, memory query results

**Edit Boundaries** (to avoid conflicts with Fix 1):

In `src/task-executor.ts` — **Fix 3 owns the result handling block AFTER middleware execution**:
```typescript
// FIX 3 INSERTION POINT (after line ~351, where result is assigned):
// After: result = await this.executeWithTimeout(task);
// Inside the middleware execute callback
// Add: contextMonitor.estimateUsage(result);
```

In `src/orchestrator.ts` — **Fix 3 owns the planning and query methods**:
- `planTask()` — add estimation after parsing
- `queryContext()` — add estimation after memory results

**Files to Modify:**

| File | Change Type | Lines |
|------|------------|-------|
| `src/context/monitor.ts` | Enhance estimator | ~26-29 |
| `src/orchestrator.ts` | Add monitor calls | ~183-192 (queryContext), ~221-269 (planTask) |
| `src/task-executor.ts` | Add monitor call | ~348-352 (inside middleware callback) |

**Implementation Steps:**

1. **Enhance `src/context/monitor.ts`**:
   ```typescript
   // Improve estimation with a more accurate heuristic
   estimateUsage(text: string): void {
     // Rough estimate: 1 token ≈ 4 characters for English text
     // For mixed content (code, markdown), use 3.5 chars/token
     const ratio = text.includes('```') || text.includes('function') ? 3.5 : 4.0;
     this.currentTokens = Math.ceil(text.length / ratio);
     this.checkThresholds();
   }
   
   // Add batch estimation for multiple texts
   estimateUsageBatch(texts: string[]): void {
     const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
     this.currentTokens = Math.ceil(totalChars / 4);
     this.checkThresholds();
   }
   ```

2. **Update `src/orchestrator.ts`**:
   ```typescript
   async queryContext(query: string): Promise<any[]> {
     if (!this.autoMemory) return [];
     try {
       const results = await this.memoryService.queryMemories(query, { limit: 10 });
       // Estimate context usage from query + results
       const resultTexts = results.map(r => r.content);
       contextMonitor.estimateUsageBatch([query, ...resultTexts]);
       return results;
     } catch {
       return [];
     }
   }
   
   async planTask(request: string): Promise<TaskGraph> {
     const graph = await this.planTaskInternal(request);
     // Estimate from request + task descriptions
     const taskTexts = graph.tasks.map(t => t.description);
     contextMonitor.estimateUsageBatch([request, ...taskTexts]);
     return graph;
   }
   ```

3. **Update `src/task-executor.ts`**:
   ```typescript
   await globalMiddleware.execute(ctx, async () => {
     result = await this.executeWithTimeout(task);
     // Update context monitor with agent output
     contextMonitor.estimateUsage(result);
   });
   ```

**Test Requirements:**
- Add test in `tests/context/monitor.test.ts` (create if missing):
  - Verify `estimateUsage()` triggers threshold callbacks
  - Verify batch estimation accumulates correctly

**Acceptance Criteria:**
- [ ] `contextMonitor.estimateUsage()` is called after every agent response
- [ ] `contextMonitor.estimateUsage()` is called after memory queries
- [ ] `contextMonitor.estimateUsage()` is called after task planning
- [ ] Threshold callbacks (40% compact, 80% handoff) are tested and fire correctly
- [ ] Documentation comment notes that token counts are estimates, not actual LLM tokens

---

### Fix 4: Sync packages/opencode-plugin/

**Problem**: The OpenCode plugin package (`packages/opencode-plugin/`) still references old MCP architecture tool names and uses the MCP client for all memory operations. The built-in integration advertised in README/docs is not actually implemented in the plugin.

**Solution**: Audit all plugin source files and replace old MemoryClient/MCP references with the correct tool names or direct integration.

**Architecture Decision**: 
The plugin has TWO viable paths:
1. **Keep MCP but fix tool names** (short-term, safer)
2. **Switch to direct imports** (long-term, matches README claims)

**Recommended Approach: Hybrid**
- Fix the MCP tool names to match what `src/server.ts` actually exposes
- Update `index.ts` to use the built-in `MemoryService` when available (detect if running inside boomerang-v2 project)
- Fall back to MCP when running as standalone plugin

**Files to Audit and Modify:**

| File | Issue | Fix |
|------|-------|-----|
| `packages/opencode-plugin/src/memory-client.ts` | Uses `super-memory_query_memory` (doesn't exist) | Change to `query_memories` |
| `packages/opencode-plugin/src/memory-client.ts` | Uses `super-memory_save_to_memory` (doesn't exist) | Change to `add_memory` |
| `packages/opencode-plugin/src/memory-client.ts` | Uses `super-memory_search_project` (doesn't exist) | Change to `search_project` |
| `packages/opencode-plugin/src/memory-client.ts` | Uses `super-memory_index_project` (doesn't exist) | Change to `index_project` |
| `packages/opencode-plugin/src/built-in-memory.ts` | Comment says "MCP wrapper" but class is `BuiltInMemory` | Update comments OR implement real built-in |
| `packages/opencode-plugin/src/native-memory.ts` | Comment says "native" but uses MCP | Update comments OR implement real native |
| `packages/opencode-plugin/src/index.ts` | Initializes `MemoryClient` via MCP | Add built-in `MemoryService` path |

**Implementation Steps:**

1. **Fix tool names in `memory-client.ts`**:
   ```typescript
   // Line ~106: Change from:
   name: "super-memory_query_memory",
   // To:
   name: "query_memories",
   
   // Line ~140: Change from:
   name: "super-memory_save_to_memory",
   // To:
   name: "add_memory",
   
   // Line ~174: Change from:
   name: "super-memory_search_project",
   // To:
   name: "search_project",
   
   // Line ~204: Change from:
   name: "super-memory_index_project",
   // To:
   name: "index_project",
   ```

2. **Update argument shapes** to match server schemas:
   ```typescript
   // query_memories expects: { query, strategy?, topK?, threshold? }
   // add_memory expects: { text, sourceType?, sourcePath?, metadata? }
   // search_project expects: { query, topK? }
   // index_project expects: { rootPath }
   ```

3. **Add built-in path to `index.ts`**:
   ```typescript
   import { getMemoryService } from '../../src/memory-service.js';
   
   // In BoomerangPlugin function:
   let useBuiltIn = false;
   try {
     const memoryService = getMemoryService();
     await memoryService.initialize();
     boomerangMemory.setMemoryService(memoryService);
     useBuiltIn = true;
     ctx.client.app.log("Using built-in Super-Memory integration");
   } catch {
     // Fall back to MCP
     try {
       const mcpClient = await initializeMemoryClient();
       boomerangMemory.setMcpClient(mcpClient);
       ctx.client.app.log("Using MCP fallback for Super-Memory");
     } catch (err) {
       ctx.client.app.log("Memory system unavailable: " + err);
     }
   }
   ```

4. **Update `memory.ts` to support both modes**:
   ```typescript
   export class BoomerangMemory {
     private mcpClient: MemoryClient | null = null;
     private memoryService: MemoryService | null = null;
     private useBuiltIn: boolean = false;
     
     setMemoryService(service: MemoryService): void {
       this.memoryService = service;
       this.useBuiltIn = true;
     }
     
     async searchMemory(query: string, limit = 5, project?: string, overrideStrategy?: EmbeddingStrategy): Promise<MemorySearchResult> {
       if (this.useBuiltIn && this.memoryService) {
         // Use direct MemoryService
         const results = await this.memoryService.queryMemories(query, { limit, strategy: overrideStrategy || this.config.strategy });
         return {
           success: true,
           results: results.map(r => ({ ...r, tier: 'transient' })),
           strategy: overrideStrategy || this.config.strategy,
         };
       }
       // Fall back to MCP path...
     }
   }
   ```

**Test Requirements:**
- Verify plugin compiles: `cd packages/opencode-plugin && npm run build`
- Run existing plugin tests: `npm test -- tests/plugin.test.ts`

**Acceptance Criteria:**
- [ ] All MCP tool names in `memory-client.ts` match server tool names
- [ ] Plugin can initialize with built-in MemoryService when available
- [ ] Plugin falls back to MCP when built-in is unavailable
- [ ] `npm run build` in plugin directory succeeds
- [ ] No references to `super-memory_*` old tool names remain in plugin source

---

### Fix 5: Document Standalone Server Usage

**Problem**: External users don't know how to run `src/server.ts` as a standalone MCP server. The README only covers plugin installation.

**Solution**: Add a comprehensive "Standalone Usage" section to README.md.

**Files to Modify:**

| File | Change Type |
|------|------------|
| `README.md` | Add new section |

**Content to Add** (insert after "## 🚚 Installation" section, before "## 🏗️ Architecture"):

```markdown
---

## 🖥️ Standalone Usage

You can run the Super-Memory MCP server standalone without the OpenCode plugin. This is useful for:
- External tool integrations
- Custom agent frameworks
- Testing and development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Veedubin/opencode-boomerang.git
cd opencode-boomerang

# Install dependencies
npm install

# Run the standalone MCP server
node src/server.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LANCEDB_URI` | `memory://` | Database URI. Use `memory://` for in-memory, or a file path like `./data/memory.db` for persistence |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |

### MCP Configuration

Add to your MCP client configuration (e.g., Claude Desktop, Cline):

```json
{
  "mcpServers": {
    "super-memory": {
      "command": "node",
      "args": ["/path/to/opencode-boomerang/src/server.ts"],
      "env": {
        "LANCEDB_URI": "./data/memory.db"
      }
    }
  }
}
```

### Available Tools

When running standalone, the server exposes these MCP tools:

| Tool | Description |
|------|-------------|
| `query_memories` | Search memories with vector similarity |
| `add_memory` | Add a new memory entry |
| `search_project` | Search indexed project files |
| `index_project` | Index a project directory |

### Example: Using with Claude Desktop

1. Add the server config to your Claude Desktop settings
2. Restart Claude Desktop
3. Ask Claude to "search my memory for database schema decisions"
4. Claude will call `query_memories` automatically

### Building for Distribution

```bash
# Type-check and build
npm run typecheck
npm run build

# The compiled server is at dist/server.js
node dist/server.js
```
```

**Test Requirements:**
- Verify the standalone server starts: `node src/server.ts`
- Verify it responds to MCP tool list requests

**Acceptance Criteria:**
- [ ] README.md contains a "Standalone Usage" section
- [ ] Section covers: quick start, environment variables, MCP configuration, available tools
- [ ] Example configuration provided for Claude Desktop
- [ ] Build instructions included

---

### Fix 6: Fix Agent Prompts for Internal vs MCP

**Problem**: All 13 agent `.md` files instruct agents to call `super-memory_query_memories` and `super-memory_add_memory`. But when running inside the boomerang-v2 plugin, the available tools are `boomerang_memory_search`, `boomerang_memory_add`, etc.

**Solution**: Update all agent prompts to reference the correct boomerang tool names.

**Architecture Decision**: 
Agents inside OpenCode with the Boomerang plugin installed have access to:
- `boomerang_memory_search` — query memories
- `boomerang_memory_add` — save to transient tier
- `boomerang_memory_save_long` — save to permanent tier
- `sequential-thinking_sequentialthinking` — chain of thought (external MCP)

The `super-memory_*` tools are ONLY for external MCP users, not for built-in plugin users.

**Files to Modify** (13 agent markdown files):

| File | Replacements |
|------|-------------|
| `agents/boomerang.md` | `super-memory_query_memories` → `boomerang_memory_search` |
| `agents/boomerang.md` | `super-memory_add_memory` → `boomerang_memory_add` |
| `agents/boomerang-coder.md` | Same replacements |
| `agents/boomerang-architect.md` | Same replacements |
| `agents/boomerang-explorer.md` | Same replacements |
| `agents/boomerang-tester.md` | Same replacements |
| `agents/boomerang-linter.md` | Same replacements |
| `agents/boomerang-git.md` | Same replacements |
| `agents/boomerang-writer.md` | Same replacements |
| `agents/boomerang-scraper.md` | Same replacements |
| `agents/boomerang-init.md` | Same replacements |
| `agents/boomerang-handoff.md` | Same replacements |
| `agents/researcher.md` | Same replacements |

**Replacement Rules** (apply consistently across ALL files):

```
super-memory_query_memories → boomerang_memory_search
super-memory_add_memory → boomerang_memory_add
super-memory_save_to_memory → boomerang_memory_save_long
```

**Important Notes:**
- Keep `sequential-thinking_sequentialthinking` as-is (it's from a different MCP server)
- Keep `searxng_*` references as-is
- The `permission` blocks already allow `boomerang_*` which covers the new tool names
- Update both the **step-by-step instructions** and the **example invocations**

**Example diff for `agents/boomerang-coder.md`**:
```diff
- 1. **Query super-memory FIRST** - Before doing ANY work, call `super-memory_query_memories` with the task description
+ 1. **Query super-memory FIRST** - Before doing ANY work, call `boomerang_memory_search` with the task description
  
- 3. **Save when complete** - Call `super-memory_add_memory` with a summary of your work
+ 3. **Save when complete** - Call `boomerang_memory_add` with a summary of your work
```

**Test Requirements:**
- Grep to verify no `super-memory_query_memories` or `super-memory_add_memory` remain:
  ```bash
  grep -r "super-memory_query_memories\|super-memory_add_memory\|super-memory_save_to_memory" agents/
  # Should return no matches
  ```

**Acceptance Criteria:**
- [ ] All 13 agent `.md` files updated
- [ ] No references to `super-memory_query_memories` remain in any agent file
- [ ] No references to `super-memory_add_memory` remain in any agent file
- [ ] Tool examples in prompts use correct boomerang tool names
- [ ] `sequential-thinking_sequentialthinking` references are preserved

---

### Fix 7: Metrics Dashboard Tool

**Problem**: `MetricsCollector` emits events to `.opencode/boomerang-metrics.jsonl` but there's no way to view them. Agents and users can't see performance trends.

**Solution**: Add a `boomerang_metrics` tool that reads the metrics file and displays aggregated statistics.

**Architecture Decision**: 
- Read from the JSONL file (already being written by MetricsCollector)
- Compute simple aggregations in-memory (no additional database needed)
- Display: agent success rates, average latency, routing decisions, recent tasks

**Edit Boundaries** (to avoid conflicts with Fix 4):

In `packages/opencode-plugin/src/index.ts` — **Fix 7 adds a new tool definition AFTER the existing tools**:
```typescript
// FIX 7 INSERTION POINT: Add after the boomerang_workspace_search_all tool definition
// (around line ~497, before the closing bracket of the tool object)
```

**Files to Modify:**

| File | Change Type | Lines |
|------|------------|-------|
| `src/metrics/collector.ts` | Add aggregation methods | New methods after line ~79 |
| `packages/opencode-plugin/src/index.ts` | Add `boomerang_metrics` tool | New tool definition |
| `docs/METRICS.md` | Update with tool usage | Add section |

**Implementation Steps:**

1. **Add aggregation to `src/metrics/collector.ts`**:
   ```typescript
   interface AgentMetrics {
     agentId: string;
     totalTasks: number;
     successfulTasks: number;
     failedTasks: number;
     avgDuration: number;
     totalTokens: number;
   }
   
   async getAgentMetrics(since?: number): Promise<AgentMetrics[]> {
     const events = await this.query({ since, limit: 10000 });
     const agentMap = new Map<string, AgentMetrics>();
     
     for (const event of events) {
       if (event.type === 'task.completed' || event.type === 'task.failed') {
         const agentId = (event.data.agent as string) || 'unknown';
         const success = event.type === 'task.completed';
         const duration = (event.data.duration as number) || 0;
         
         if (!agentMap.has(agentId)) {
           agentMap.set(agentId, {
             agentId,
             totalTasks: 0,
             successfulTasks: 0,
             failedTasks: 0,
             avgDuration: 0,
             totalTokens: 0,
           });
         }
         
         const metrics = agentMap.get(agentId)!;
         metrics.totalTasks++;
         if (success) metrics.successfulTasks++;
         else metrics.failedTasks++;
         metrics.avgDuration = (metrics.avgDuration * (metrics.totalTasks - 1) + duration) / metrics.totalTasks;
       }
     }
     
     return Array.from(agentMap.values());
   }
   
   async getRoutingDecisions(since?: number, limit = 20): Promise<any[]> {
     const events = await this.query({ since, type: 'routing.decision', limit });
     return events.map(e => ({
       timestamp: e.timestamp,
       taskType: e.data.taskType,
       agent: e.data.agent,
       method: e.data.method,
     }));
   }
   ```

2. **Add tool in `packages/opencode-plugin/src/index.ts`**:
   ```typescript
   boomerang_metrics: tool({
     description: "View Boomerang performance metrics: agent success rates, average latency, routing decisions",
     args: {
       agent: tool.schema.string().optional().describe("Filter by agent name"),
       since: tool.schema.string().optional().describe("ISO date string for time range (e.g., '2026-04-20')"),
       limit: tool.schema.number().optional().describe("Max routing decisions to show (default: 20)"),
     },
     async execute(args: { agent?: string; since?: string; limit?: number }) {
       const sinceMs = args.since ? new Date(args.since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
       const limit = args.limit || 20;
       
       const metricsCollector = (await import('../../src/metrics/collector.js')).metricsCollector;
       const agentMetrics = await metricsCollector.getAgentMetrics(sinceMs);
       const routingDecisions = await metricsCollector.getRoutingDecisions(sinceMs, limit);
       
       let output = `## Boomerang Metrics (Last ${args.since || '7 days'})\n\n`;
       
       // Agent performance table
       output += `### Agent Performance\n\n`;
       output += `| Agent | Tasks | Success Rate | Avg Duration |\n`;
       output += `|-------|-------|-------------|--------------|\n`;
       
       for (const m of agentMetrics) {
         if (args.agent && m.agentId !== args.agent) continue;
         const successRate = m.totalTasks > 0 ? ((m.successfulTasks / m.totalTasks) * 100).toFixed(1) : '0';
         output += `| ${m.agentId} | ${m.totalTasks} | ${successRate}% | ${Math.round(m.avgDuration)}ms |\n`;
       }
       
       // Routing decisions
       output += `\n### Recent Routing Decisions\n\n`;
       for (const decision of routingDecisions.slice(-limit)) {
         const date = new Date(decision.timestamp).toLocaleDateString();
         output += `- ${date}: ${decision.taskType} → ${decision.agent} (${decision.method})\n`;
       }
       
       return output;
     },
   }),
   ```

**Test Requirements:**
- Add test in `tests/metrics/dashboard.test.ts`:
  - Emit sample metrics events
  - Verify `getAgentMetrics()` returns correct aggregates
  - Verify `getRoutingDecisions()` returns routing events

**Acceptance Criteria:**
- [ ] `boomerang_metrics` tool is registered in the plugin
- [ ] Tool displays agent success rates in tabular format
- [ ] Tool displays average task duration per agent
- [ ] Tool displays recent routing decisions
- [ ] Tool supports filtering by agent name
- [ ] Tool supports time range filtering
- [ ] Metrics are read from `.opencode/boomerang-metrics.jsonl`

---

### Fix 8: Graceful Degradation

**Problem**: If `MemoryService.initialize()` fails (e.g., LanceDB not available, model loading fails), the entire system crashes. `src/index.ts` has `await memoryService.initialize()` with no try/catch.

**Solution**: Add fallback mode throughout the system. Operate without memory when initialization fails.

**Architecture Decision**: 
- `MemoryService` gets a `fallbackMode` flag
- When `fallbackMode = true`, all memory operations return empty results instead of throwing
- The orchestrator continues planning and execution without memory context
- Agents still work but don't persist or retrieve context

**Edit Boundaries** (to avoid conflicts with Fix 1):

In `src/memory-service.ts` — **Fix 8 owns `initialize()` and `ensureInitialized()`**:
```typescript
// FIX 8 MODIFIES: initialize() method (lines ~35-39)
// FIX 8 MODIFIES: ensureInitialized() method (lines ~95-99)
// FIX 8 DOES NOT TOUCH: queryMemories(), addMemory(), searchProject(), indexProject() operational code
```

**Files to Modify:**

| File | Change Type | Lines |
|------|------------|-------|
| `src/memory-service.ts` | Add fallback mode | ~28, ~35-39, ~91-99 |
| `src/index.ts` | Catch init failure | ~72-75 |
| `src/orchestrator.ts` | Handle missing memory | ~183-192 |
| `src/protocol/enforcer.ts` | Skip auto-fix if no memory | ~54-62, ~89-98 |

**Implementation Steps:**

1. **Update `src/memory-service.ts`**:
   ```typescript
   export class MemoryService {
     private memorySystem: MemorySystem;
     private initialized = false;
     private activeIndexer: ProjectIndexer | null = null;
     private fallbackMode = false;
   
     async initialize(dbUri?: string): Promise<void> {
       if (this.initialized) return;
       try {
         await this.memorySystem.initialize(dbUri);
         this.initialized = true;
       } catch (error) {
         console.warn(`[MemoryService] Initialization failed, entering fallback mode: ${error instanceof Error ? error.message : String(error)}`);
         this.fallbackMode = true;
         this.initialized = true; // Mark as "ready" but in fallback
       }
     }
   
     isFallbackMode(): boolean {
       return this.fallbackMode;
     }
   
     async queryMemories(query: string, options: MemoryQueryOptions = {}): Promise<MemoryEntry[]> {
       if (this.fallbackMode) {
         console.warn(`[MemoryService] Fallback mode: returning empty results for query`);
         return [];
       }
       this.ensureInitialized();
       // ... existing code
     }
   
     async addMemory(entry: { ... }): Promise<{ id: string }> {
       if (this.fallbackMode) {
         console.warn(`[MemoryService] Fallback mode: skipping memory add`);
         return { id: `fallback-${Date.now()}` };
       }
       this.ensureInitialized();
       // ... existing code
     }
   
     private ensureInitialized(): void {
       if (!this.initialized) {
         throw new Error('MemoryService not initialized. Call initialize() first.');
       }
       // Don't throw in fallback mode — it's "initialized" enough to return empty results
     }
   }
   ```

2. **Update `src/index.ts`**:
   ```typescript
   export async function execute(context: PluginContext): Promise<void> {
     const [command, ...args] = context.args;
   
     // Initialize memory system (with fallback)
     memoryService = getMemoryService();
     try {
       await memoryService.initialize();
     } catch (error) {
       console.warn('Memory system unavailable, continuing without persistence:', error);
       // memoryService is now in fallback mode
     }
     
     // ... rest of function
   }
   ```

3. **Update `src/orchestrator.ts`**:
   ```typescript
   async queryContext(query: string): Promise<any[]> {
     if (!this.autoMemory) return [];
     try {
       if (this.memoryService.isFallbackMode()) {
         return []; // Skip query in fallback mode
       }
       const results = await this.memoryService.queryMemories(query, { limit: 10 });
       return results;
     } catch {
       return [];
     }
   }
   ```

4. **Update `src/protocol/enforcer.ts`**:
   ```typescript
   async validatePreConditions(sessionId: string, taskDescription: string): Promise<EnforcementResult> {
     // ...
     if (this.config.enforceMemoryQuery && !checkpoints.memoryQueried) {
       // ...
       if (this.config.autoFix) {
         try {
           const memoryService = getMemoryService();
           if (memoryService.isInitialized() && !memoryService.isFallbackMode()) {
             await memoryService.queryMemories(taskDescription, { limit: 5 });
             protocolTracker.recordToolCall(sessionId, 'query_memories', { query: taskDescription });
             autoFixed.push(violation);
           }
         } catch { /* auto-fix failed */ }
       }
     }
     // ...
   }
   ```

**Test Requirements:**
- Add test in `tests/memory-service.test.ts` (create if missing):
  - Verify `initialize()` with failure sets fallback mode
  - Verify `queryMemories()` returns `[]` in fallback mode
  - Verify `addMemory()` returns dummy ID in fallback mode

**Acceptance Criteria:**
- [ ] `MemoryService.initialize()` catches errors and enters fallback mode
- [ ] `memoryService.isFallbackMode()` returns `true` when init fails
- [ ] `queryMemories()` returns empty array in fallback mode (no throw)
- [ ] `addMemory()` returns a dummy ID in fallback mode (no throw)
- [ ] `src/index.ts` continues execution if memory init fails
- [ ] `src/orchestrator.ts` handles fallback mode gracefully
- [ ] Protocol enforcer skips memory auto-fix in fallback mode
- [ ] Warning logs are emitted when operating in fallback mode

---

## 4. Files to Modify Per Fix

### Fix 1: Wire Protocol Tracker
| File | Action |
|------|--------|
| `src/protocol/tracker.ts` | Add `recordInternalToolCall()` helper |
| `src/server.ts` | Add `protocolTracker.recordToolCall()` to 4 handlers |
| `src/memory-service.ts` | Add tracking in 4 public methods |
| `src/task-executor.ts` | Add tracking in `executeSingle()` |
| `tests/protocol/tracker.test.ts` | **NEW** — test tracking behavior |

### Fix 2: Real Integration Tests
| File | Action |
|------|--------|
| `tests/integration/real-memory.test.ts` | **NEW** — real add→query tests |
| `tests/integration/real-project-index.test.ts` | **NEW** — real index→search tests |
| `vitest.config.ts` | Add longer timeout for integration tests |

### Fix 3: Context Monitor Token Source
| File | Action |
|------|--------|
| `src/context/monitor.ts` | Enhance `estimateUsage()`, add `estimateUsageBatch()` |
| `src/orchestrator.ts` | Call `contextMonitor.estimateUsage()` after planning/querying |
| `src/task-executor.ts` | Call `contextMonitor.estimateUsage()` after agent execution |
| `tests/context/monitor.test.ts` | **NEW** — test estimation and thresholds |

### Fix 4: Sync Plugin Package
| File | Action |
|------|--------|
| `packages/opencode-plugin/src/memory-client.ts` | Fix 4 tool names to match server |
| `packages/opencode-plugin/src/memory.ts` | Add built-in `MemoryService` support |
| `packages/opencode-plugin/src/built-in-memory.ts` | Update comments or implement real built-in |
| `packages/opencode-plugin/src/native-memory.ts` | Update comments or implement real native |
| `packages/opencode-plugin/src/index.ts` | Initialize built-in first, fall back to MCP |

### Fix 5: Document Standalone Server
| File | Action |
|------|--------|
| `README.md` | Add "Standalone Usage" section |

### Fix 6: Fix Agent Prompts
| File | Action |
|------|--------|
| `agents/boomerang.md` | Replace tool names |
| `agents/boomerang-coder.md` | Replace tool names |
| `agents/boomerang-architect.md` | Replace tool names |
| `agents/boomerang-explorer.md` | Replace tool names |
| `agents/boomerang-tester.md` | Replace tool names |
| `agents/boomerang-linter.md` | Replace tool names |
| `agents/boomerang-git.md` | Replace tool names |
| `agents/boomerang-writer.md` | Replace tool names |
| `agents/boomerang-scraper.md` | Replace tool names |
| `agents/boomerang-init.md` | Replace tool names |
| `agents/boomerang-handoff.md` | Replace tool names |
| `agents/researcher.md` | Replace tool names |

### Fix 7: Metrics Dashboard Tool
| File | Action |
|------|--------|
| `src/metrics/collector.ts` | Add `getAgentMetrics()`, `getRoutingDecisions()` |
| `packages/opencode-plugin/src/index.ts` | Add `boomerang_metrics` tool |
| `docs/METRICS.md` | Add tool usage documentation |
| `tests/metrics/dashboard.test.ts` | **NEW** — test aggregation logic |

### Fix 8: Graceful Degradation
| File | Action |
|------|--------|
| `src/memory-service.ts` | Add fallback mode to `initialize()`, `queryMemories()`, `addMemory()` |
| `src/index.ts` | Catch memory init failure, continue execution |
| `src/orchestrator.ts` | Check fallback mode before memory queries |
| `src/protocol/enforcer.ts` | Skip auto-fix if memory is in fallback mode |
| `tests/memory-service.test.ts` | **NEW** — test fallback behavior |

---

## 5. Estimated Effort Per Fix

| Fix | Hours | Complexity | Risk |
|-----|-------|-----------|------|
| 1. Protocol Tracker | 2–3 | Low | Low |
| 2. Integration Tests | 4–6 | Medium | Medium (model loading) |
| 3. Context Monitor | 2–3 | Low | Low |
| 4. Plugin Sync | 3–5 | Medium | Medium (package boundary) |
| 5. Standalone Docs | 1–2 | Low | None |
| 6. Agent Prompts | 3–4 | Low | Low (tedious but mechanical) |
| 7. Metrics Dashboard | 4–5 | Medium | Low |
| 8. Graceful Degradation | 3–4 | Medium | Low |
| **TOTAL** | **22–32** | | |

---

## 6. Testing Strategy

### Unit Tests (per fix)
Each fix must include unit tests for new/modified code.

### Integration Tests
- Run the new real integration tests: `npm test -- tests/integration/real-*.test.ts`
- Verify the full pipeline: `npm test -- tests/integration/full-pipeline.test.ts`

### End-to-End Verification
After ALL fixes are merged:

```bash
# 1. Typecheck everything
npm run typecheck

# 2. Run all tests
npm test -- --run

# 3. Build the plugin
cd packages/opencode-plugin && npm run build

# 4. Verify standalone server starts
node src/server.ts &
# (send ListTools request via MCP, verify 4 tools are listed)
kill %1

# 5. Verify graceful degradation
# (temporarily break LanceDB path, verify system still starts)
```

---

## 7. Rollback Plan

If any fix introduces regressions:

1. **Fix 1, 3, 7, 8** (core changes): Revert the specific commit, the system will continue to work without the fix (degraded but functional)
2. **Fix 2** (tests only): Safe to revert, no production impact
3. **Fix 4** (plugin changes): Revert to previous plugin build, MCP client will reconnect
4. **Fix 5** (docs only): Safe to revert, no production impact
5. **Fix 6** (agent prompts): Revert agent files, agents will use old tool names (may fail if tools don't exist)

---

## 8. Coordination Notes for Parallel Execution

### Agent Assignments
| Agent | Fix | Primary Files |
|-------|-----|--------------|
| Coder A | Fix 1 | `src/protocol/tracker.ts`, `src/server.ts`, `src/memory-service.ts`, `src/task-executor.ts` |
| Coder B | Fix 2 | `tests/integration/real-memory.test.ts`, `tests/integration/real-project-index.test.ts` |
| Coder C | Fix 3 | `src/context/monitor.ts`, `src/orchestrator.ts`, `src/task-executor.ts` |
| Coder D | Fix 4 | `packages/opencode-plugin/src/memory-client.ts`, `memory.ts`, `built-in-memory.ts`, `native-memory.ts`, `index.ts` |
| Coder E | Fix 5 | `README.md` |
| Coder F | Fix 6 | `agents/*.md` (13 files) |
| Coder G | Fix 7 | `src/metrics/collector.ts`, `packages/opencode-plugin/src/index.ts` |
| Coder H | Fix 8 | `src/memory-service.ts`, `src/index.ts`, `src/orchestrator.ts`, `src/protocol/enforcer.ts` |

### Merge Conflict Resolution
If two agents modify the same file:

1. **`src/memory-service.ts`** — Coder A (Fix 1) and Coder H (Fix 8):
   - **Resolution**: Coder H's changes to `initialize()` and `ensureInitialized()` take precedence. Coder A's tracking calls go inside the operational methods (`queryMemories`, `addMemory`, etc.) which Coder H doesn't modify.

2. **`src/task-executor.ts`** — Coder A (Fix 1) and Coder C (Fix 3):
   - **Resolution**: Coder A adds tracking BEFORE middleware execution. Coder C adds estimation AFTER middleware execution. Both changes fit in the same method without overlap.

3. **`src/orchestrator.ts`** — Coder C (Fix 3) and Coder H (Fix 8):
   - **Resolution**: Coder C modifies `queryContext()` to add estimation. Coder H modifies `queryContext()` to check fallback mode. The changes are compatible — add fallback check first, then estimation.

4. **`packages/opencode-plugin/src/index.ts`** — Coder D (Fix 4) and Coder G (Fix 7):
   - **Resolution**: Coder D modifies the plugin initialization and memory tools. Coder G adds a new `boomerang_metrics` tool. The new tool is added to the `tool` object which has many existing tools — minimal conflict risk.

### Communication Protocol
- Each coder creates a feature branch: `fix/N-short-name`
- Before starting, coder reads this plan and the "Edit Boundaries" for their fix
- After completing, coder runs `npm run typecheck` and `npm test -- --run`
- Coder submits PR with fix number in title: `[Fix 1] Wire protocol tracker to tool calls`
- Integration lead merges in order: Fix 8 → Fix 1 → Fix 3 → others (if conflicts arise)

---

*End of Execution Plan*
