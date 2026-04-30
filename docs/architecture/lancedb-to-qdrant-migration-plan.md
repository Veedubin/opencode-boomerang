# Architectural Plan: Migrate boomerang-v2 from LanceDB to Super-Memory-TS/Qdrant

**Version**: 1.0  
**Date**: 2026-04-29  
**Status**: Ready for Implementation  

---

## 1. Executive Summary

This plan details the migration of boomerang-v2's memory backend from its embedded LanceDB implementation to Super-Memory-TS's Qdrant-based memory system via direct import integration (not MCP client mode). Super-Memory-TS remains a standalone MCP server for external users.

### Why This Migration

- **Code duplication**: Both projects maintain parallel memory stacks (LanceDB vs Qdrant, two ModelManagers, two project indexers)
- **Previous failure**: Commit `cd93abd` attempted migration and was reverted (`418c5f2`) — likely due to unresolved dual-ModelManager VRAM collision
- **Documentation gap**: README incorrectly claims integration is already complete
- **Architecture mandate**: Boomerang-v2 must use Super-Memory-TS as its native memory backend

---

## 2. Research Summary

### 2.1 Files Identified

**boomerang-v2 LanceDB stack (to be removed/replaced):**
| File | Purpose | Lines |
|------|---------|-------|
| `src/memory/index.ts` | MemorySystem singleton | 134 |
| `src/memory/database.ts` | LanceDBPool connection manager | 116 |
| `src/memory/operations.ts` | CRUD operations | 200 |
| `src/memory/search.ts` | Vector + text search strategies | 228 |
| `src/memory/text-search.ts` | Fuse.js wrapper | 75 |
| `src/memory/schema.ts` | Type definitions | 72 |
| `src/memory-service.ts` | Service wrapper with fallback | 173 |
| `src/model/index.ts` | ModelManager singleton | 153 |
| `src/model/types.ts` | Model configs | — |
| `src/project-index/indexer.ts` | LanceDB project indexer | 365 |
| `src/project-index/search.ts` | LanceDB project search | 164 |
| `src/project-index/types.ts` | Project index types | 95 |
| `src/server.ts` | boomerang-v2 MCP server (duplicates Super-Memory-TS) | 329 |

**Super-Memory-TS Qdrant stack (to be imported):**
| File | Purpose |
|------|---------|
| `src/memory/index.ts` | MemorySystem with project isolation |
| `src/memory/database.ts` | Qdrant client with retry logic |
| `src/memory/search.ts` | TIERED/VECTOR_ONLY/TEXT_ONLY search |
| `src/memory/schema.ts` | Types (Date timestamps, Float32Array vectors) |
| `src/model/index.ts` | ModelManager singleton (acquire/release pattern) |
| `src/model/embeddings.ts` | Batch embedding generation |
| `src/project-index/indexer.ts` | Qdrant-based ProjectIndexer |
| `src/project-index/types.ts` | Project index types |
| `src/server.ts` | Standalone MCP server |

**Callers of memory in boomerang-v2:**
- `src/index.ts` — initializes MemoryService
- `src/orchestrator.ts` — queries/adds memories per task
- `src/protocol/enforcer.ts` — protocol memory hooks
- `src/context/compactor.ts` — saves context to memory
- `src/tui/hooks/useMemory.ts` — mock implementation (needs wiring)
- `src/tui/hooks/useSession.ts` — mock implementation (needs wiring)
- `src/server.ts` — MCP tool handlers

### 2.2 Critical API Differences

| Aspect | boomerang-v2 (LanceDB) | Super-Memory-TS (Qdrant) |
|--------|----------------------|--------------------------|
| `MemoryEntry.timestamp` | `number` (epoch ms) | `Date` object |
| `MemoryEntry.vector` | `number[]` | `Float32Array` |
| `addMemory()` return | `Promise<MemoryEntry>` | `Promise<string>` (id only) |
| `search()` return | `SearchResult<MemoryEntry>[]` (separate score) | `MemoryEntry[]` (score on entry) |
| `saveContext()` / `getContext()` | ✅ Exists | ❌ Not implemented |
| `listSources()` | ✅ Exists | ❌ Not implemented |
| `dbUri` semantics | LanceDB path (`memory://`) | Qdrant URL (`http://localhost:6333`) |
| Project isolation | ❌ None | ✅ Payload filtering via `projectId` |
| ModelManager API | `loadModel()` / `generateEmbedding()` / `unloadModel()` | `acquire()` / `getExtractor()` / `release()` |

### 2.3 Root Cause of Previous Migration Failure (cd93abd → 418c5f2)

The most likely cause was **dual ModelManager collision**:
- Both boomerang-v2 and Super-Memory-TS define their own `ModelManager` singleton
- When boomerang-v2 imports Super-Memory-TS, Node.js creates **two separate singleton instances**
- Both load `@xenova/transformers` pipelines into VRAM simultaneously
- Result: VRAM exhaustion, OOM crashes, or model download conflicts
- **Fix**: Delete boomerang-v2's `src/model/` and use Super-Memory-TS's ModelManager exclusively

---

## 3. Architecture Decisions

### 3.1 Dependency Model: npm package dependency

**Decision**: Add `"@veedubin/super-memory-ts": "^2.3.7"` to boomerang-v2's `dependencies`.

**Rationale**:
- Both packages are independently published and versioned
- boomerang-v2 README already documents `@veedubin/super-memory-ts` as the memory backend
- Clean separation of concerns — boomerang-v2 imports the memory layer like any other dependency
- For local development, developers can use `npm link` or temporarily replace with `file:../Super-Memory-TS`

**Action**: Update `boomerang-v2/package.json`:
```json
"dependencies": {
  "@veedubin/super-memory-ts": "^2.3.7",
  "@modelcontextprotocol/sdk": "^1.29.0",
  "uuid": "^14.0.0",
  "zod": "^3.23.8"
}
```

### 3.2 Integration Pattern: Thin Adapter Wrapper

**Decision**: boomerang-v2's `MemorySystem` becomes a thin adapter that delegates to Super-Memory-TS's `MemorySystem`, handling type conversions and preserving boomerang-v2's API contract.

**Rationale**:
- Preserves existing API surface used by orchestrator, protocol enforcer, TUI, and server
- Type conversions (Date ↔ number, Float32Array ↔ number[]) isolated in one place
- Allows graceful fallback mode to continue working
- Minimizes changes across 10+ caller files
- Easier to debug — adapter layer is explicit

**Adapter responsibilities**:
1. Convert `number` timestamps to/from `Date`
2. Convert `number[]` vectors to/from `Float32Array`
3. Re-implement `saveContext()` / `getContext()` on top of `queryMemories()` with `sessionId` filter
4. Re-implement `listSources()` on top of `listMemories()` with deduplication
5. Wrap `addMemory()` to return full `MemoryEntry` instead of just `id`
6. Wrap `queryMemories()` to return `SearchResult[]` with separate score field

### 3.3 ModelManager Reconciliation: Delete boomerang-v2's model layer

**Decision**: Remove `boomerang-v2/src/model/` entirely. All embedding needs are satisfied by Super-Memory-TS's `ModelManager` and `generateEmbeddings()`.

**Rationale**:
- This was the fatal flaw in the previous migration attempt
- All current callers of boomerang-v2's `modelManager` are in files being deleted (memory/operations.ts, memory/search.ts, project-index/indexer.ts, project-index/search.ts)
- Super-Memory-TS's `generateEmbeddings()` provides batch embedding with the same underlying `@xenova/transformers` pipeline
- Eliminates VRAM duplication and model download conflicts

**Exports to use from `@veedubin/super-memory-ts`**:
```typescript
import { ModelManager } from '@veedubin/super-memory-ts/dist/model/index.js';
import { generateEmbeddings, generateEmbedding } from '@veedubin/super-memory-ts/dist/model/embeddings.js';
```

### 3.4 Project Indexer: Replace with Super-Memory-TS implementation

**Decision**: Delete boomerang-v2's `src/project-index/indexer.ts` and `src/project-index/search.ts`. Use Super-Memory-TS's `ProjectIndexer` and its `search()` / `getFileContents()` methods.

**Rationale**:
- Super-Memory-TS already has a mature Qdrant-based ProjectIndexer with:
  - File watching via chokidar
  - Incremental updates with SHA-256 hashing
  - Batch writes with memory management
  - Pause/resume for priority operations
  - Event-based progress tracking
- boomerang-v2's LanceDB indexer is functionally inferior (no batching, no memory management)
- Project chunks are stored in the same Qdrant collection as memories (sourceType='project'), enabling unified search if needed

**API mapping**:
| boomerang-v2 | Super-Memory-TS |
|--------------|----------------|
| `ProjectIndexer(dbUri, rootPath)` | `new ProjectIndexer(config, dbUri, projectId)` |
| `indexer.start()` | `indexer.start()` |
| `indexer.stop()` | `indexer.stop()` |
| `searchProject(query, topK)` | `indexer.search(query, { topK })` |
| `getFileContents(filePath)` | `indexer.getFileContents(filePath)` |

### 3.5 Project Isolation: Leverage BOOMERANG_PROJECT_ID

**Decision**: Pass `projectId` from `BOOMERANG_PROJECT_ID` env var (or cwd basename) to Super-Memory-TS's `MemorySystem` and `ProjectIndexer`.

**Rationale**:
- Super-Memory-TS already implements project isolation via Qdrant payload filtering
- boomerang-v2 currently has no project isolation — all memories go to `memory://`
- Using cwd basename as default projectId matches Super-Memory-TS's existing `generateProjectId()` behavior
- This is a feature gain, not just parity

**Implementation**:
```typescript
import { generateProjectId } from '@veedubin/super-memory-ts/dist/config.js';

const projectId = generateProjectId();
const memorySystem = getMemorySystem({ dbUri: qdrantUrl, projectId });
```

### 3.6 MCP Server Strategy: Deprecate boomerang-v2's standalone server

**Decision**: Update `boomerang-v2/src/server.ts` to use the wrapped memory system, but mark it as deprecated. External users should use Super-Memory-TS's MCP server directly.

**Rationale**:
- Super-Memory-TS's `src/server.ts` is the canonical MCP server implementation
- boomerang-v2's `src/server.ts` duplicates the same tools with the same schemas
- Maintaining two MCP servers creates drift risk
- boomerang-v2's primary value is orchestration, not the memory MCP server

**Action**: Add deprecation comment and log warning in boomerang-v2's server.ts:
```typescript
console.warn('[DEPRECATED] boomerang-v2 MCP server is deprecated. Use @veedubin/super-memory-ts for standalone memory MCP server.');
```

---

## 4. File-by-File Migration Plan

### 4.1 Files to DELETE

| File | Reason |
|------|--------|
| `src/memory/database.ts` | LanceDBPool — replaced by Qdrant |
| `src/memory/operations.ts` | LanceDB CRUD — replaced by Super-Memory-TS MemoryDatabase |
| `src/memory/search.ts` | LanceDB search — replaced by Super-Memory-TS MemorySearch |
| `src/memory/text-search.ts` | Fuse.js wrapper — Super-Memory-TS has its own |
| `src/model/index.ts` | ModelManager — use Super-Memory-TS's singleton |
| `src/model/types.ts` | Model configs — use Super-Memory-TS's types |
| `src/project-index/indexer.ts` | LanceDB indexer — use Super-Memory-TS's ProjectIndexer |
| `src/project-index/search.ts` | LanceDB project search — use ProjectIndexer.search() |
| `src/project-index/chunker.ts` | Use Super-Memory-TS's FileChunker if API-compatible, else keep |
| `src/project-index/watcher.ts` | Use Super-Memory-TS's ProjectWatcher if API-compatible, else keep |

> **Note on chunker/watcher**: Super-Memory-TS exports `FileChunker`, `ProjectWatcher`, `createChunker`, `createWatcher`. If boomerang-v2 has custom logic in these, audit first. If they're thin wrappers around chokidar, delete and import from Super-Memory-TS.

### 4.2 Files to MODIFY

| File | Changes |
|------|---------|
| `src/memory/index.ts` | **Rewrite**: Thin adapter wrapping Super-Memory-TS MemorySystem. Preserve singleton pattern and all public methods. Handle type conversions. |
| `src/memory/schema.ts` | **Keep but adapt**: Preserve types for backward compatibility. Re-export adapted types from Super-Memory-TS where possible. Add conversion utilities. |
| `src/memory-service.ts` | **Update imports**: Import from `./memory/index.js` (which now wraps Super-Memory-TS). Update `indexProject()` to use Super-Memory-TS's ProjectIndexer. No API changes. |
| `src/index.ts` | **Update imports**: Ensure memory initialization uses Qdrant URL instead of LanceDB URI. Update env var checks. |
| `src/orchestrator.ts` | **Update imports**: No logic changes — uses MemoryService which preserves API. |
| `src/protocol/enforcer.ts` | **Update imports**: No logic changes — uses MemoryService. |
| `src/context/compactor.ts` | **Update imports**: No logic changes — uses MemoryService. |
| `src/tui/hooks/useMemory.ts` | **Wire to real system**: Replace mock `getMemorySystem()` with adapter instance. Implement `setMemorySystem()` call during TUI init. |
| `src/tui/hooks/useSession.ts` | **Wire to real system**: Replace mock with adapter. Implement `getMemoriesBySource()` on adapter. |
| `src/server.ts` | **Update handlers**: Use wrapped memory system. Add deprecation warning. |
| `package.json` | Add `@veedubin/super-memory-ts` dependency. Remove `@lancedb/lancedb` if present. |

### 4.3 Files to CREATE

| File | Purpose |
|------|---------|
| `src/memory/adapter.ts` | **NEW**: Core adapter logic — type conversion utilities (`dateToTimestamp`, `timestampToDate`, `vectorToFloat32Array`, `float32ArrayToVector`) |
| `scripts/migrate-lancedb-to-qdrant.ts` | **NEW**: Ingest script for migrating existing LanceDB data to Qdrant |
| `src/memory/index.test.ts` | **NEW**: Tests for the adapter wrapper |
| `tests/integration/super-memory-adapter.test.ts` | **NEW**: Integration tests verifying adapter + Super-Memory-TS work together |

### 4.4 Exact API Mapping

**MemorySystem.addMemory()**
```typescript
// boomerang-v2 API
async addMemory(entry: Omit<MemoryEntry, 'id' | 'vector' | 'timestamp' | 'contentHash'>): Promise<MemoryEntry>

// Super-Memory-TS API
async addMemory(input: MemoryEntryInput): Promise<string>

// Adapter implementation
async addMemory(entry): Promise<MemoryEntry> {
  const id = await this.smtMemory.addMemory({
    text: entry.text,
    sourceType: mapSourceType(entry.sourceType), // 'conversation' → 'session'
    sourcePath: entry.sourcePath,
    metadataJson: entry.metadataJson,
    sessionId: entry.sessionId,
  });
  
  const memory = await this.smtMemory.getMemory(id);
  return adaptMemoryEntry(memory!); // Convert Date→number, Float32Array→number[]
}
```

**MemorySystem.search()**
```typescript
// boomerang-v2 API
async search(query: string, options?: Partial<SearchOptions>): Promise<SearchResult<MemoryEntry>[]>

// Super-Memory-TS API
async queryMemories(question: string, options?: SearchOptions): Promise<MemoryEntry[]>

// Adapter implementation
async search(query, options): Promise<SearchResult<MemoryEntry>[]> {
  const results = await this.smtMemory.queryMemories(query, {
    topK: options?.topK ?? 10,
    strategy: options?.strategy ?? 'TIERED',
    threshold: options?.threshold ?? 0.7,
  });
  
  return results.map(r => ({
    entry: adaptMemoryEntry(r),
    score: r.score ?? 0,
  }));
}
```

**MemorySystem.saveContext() / getContext()**
```typescript
// New implementation using Super-Memory-TS APIs
async saveContext(sessionId: string, context: string): Promise<MemoryEntry> {
  return this.addMemory({
    text: context,
    sourceType: 'conversation',
    sourcePath: `session://${sessionId}`,
    sessionId,
    metadataJson: JSON.stringify({ type: 'context' }),
  });
}

async getContext(sessionId: string): Promise<MemoryEntry | null> {
  const results = await this.smtMemory.listMemories({
    sourceType: 'session', // 'conversation' maps to 'session' in SMT
    sessionId,
  });
  
  if (results.length === 0) return null;
  
  // Sort by timestamp descending
  const sorted = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return adaptMemoryEntry(sorted[0]);
}
```

**SourceType Mapping**
| boomerang-v2 | Super-Memory-TS |
|--------------|----------------|
| `file` | `file` |
| `conversation` | `session` |
| `manual` | `session` |
| `web` | `web` |

---

## 5. Ingest Script Design

### 5.1 Purpose
Migrate existing LanceDB `memory_entries` and `project_chunks` tables to Qdrant without data loss.

### 5.2 Script Location
`boomerang-v2/scripts/migrate-lancedb-to-qdrant.ts`

### 5.3 Algorithm

```
1. Parse command-line arguments:
   --lancedb-uri     LanceDB URI (default: memory:// or from env)
   --qdrant-url      Qdrant URL (default: http://localhost:6333)
   --project-id      Project ID for isolation (default: from env or cwd)
   --batch-size      Embedding batch size (default: 8)
   --dry-run         Validate without writing
   --resume          Resume from previous run using state file

2. Initialize connections:
   - Open LanceDB (read-only)
   - Initialize Super-Memory-TS MemorySystem (connects to Qdrant)

3. Migrate memory_entries:
   a. Read all rows from LanceDB memory_entries table
   b. For each batch of N entries:
      - Extract text content
      - Generate embeddings via Super-Memory-TS's generateEmbeddings()
      - Transform to MemoryEntryInput format
      - Insert into Qdrant via memorySystem.addMemory() or db.addMemories()
      - Log progress every batch
      - Save state to .migration-state.json

4. Migrate project_chunks:
   a. Read all rows from LanceDB project_chunks table
   b. Group by filePath
   c. For each chunk batch:
      - Generate embeddings for chunk content
      - Transform to MemoryEntryInput with sourceType='project'
      - Insert into Qdrant
      - Log progress

5. Validate migration:
   - Count LanceDB entries = Count Qdrant entries
   - Sample random entries and compare contentHash
   - Report any mismatches

6. Cleanup:
   - Write completion report
   - Optionally rename LanceDB directory as backup
```

### 5.4 Embedding Regeneration Strategy

**Decision**: Regenerate all embeddings during migration.

**Rationale**:
- Ensures vector precision matches Super-Memory-TS's configured precision (fp16 default)
- Guarantees dimension consistency with the active model
- Avoids silent corruption from model version mismatches
- LanceDB vectors are `number[]`, Qdrant expects consistent Float32Array

**Performance optimization**:
- Use `generateEmbeddings(texts, batchSize)` for parallel embedding generation
- Process 100-500 entries at a time to control memory usage
- For project chunks, group by file and process files in parallel up to CPU count

### 5.5 State Tracking for Resumability

```typescript
interface MigrationState {
  startedAt: string;
  lancedbUri: string;
  qdrantUrl: string;
  projectId?: string;
  memoryEntries: {
    total: number;
    migrated: number;
    lastId?: string;
  };
  projectChunks: {
    total: number;
    migrated: number;
    lastFilePath?: string;
  };
  errors: Array<{ item: string; error: string; timestamp: string }>;
}
```

State file: `.migration-state.json` in working directory.

### 5.6 Error Handling

| Scenario | Handling |
|----------|----------|
| Qdrant unreachable | Retry 3× with exponential backoff, then fail with clear message |
| Embedding generation fails | Log error, skip entry, continue migration, report at end |
| LanceDB table missing | Warn and skip that table |
| Duplicate contentHash | Skip (idempotent — running twice is safe) |
| Partial failure | Save state, exit with non-zero, allow `--resume` |

---

## 6. Breaking Changes and Migration Path

### 6.1 Breaking Changes

| Change | Impact | Mitigation |
|--------|--------|------------|
| LanceDB dependency removed | Users with `memory://` directories lose native storage | Ingest script migrates data |
| Qdrant becomes required | Users must run Qdrant docker container | MemoryService fallback mode returns empty results instead of crashing |
| `LANCEDB_URI` env var obsolete | Existing configs using this var | Accept `QDRANT_URL` instead; log warning if `LANCEDB_URI` is set |
| `dbUri` parameter semantics change | `memory://` → `http://localhost:6333` | Document in CHANGELOG; fallback mode if URL is invalid |
| ModelManager API changes | `loadModel()`/`generateEmbedding()` → `acquire()`/`generateEmbeddings()` | Only affects custom code using boomerang-v2's model/ directly (rare) |

### 6.2 User Migration Path

1. **Install/update boomerang-v2** (which now depends on `@veedubin/super-memory-ts`)
2. **Start Qdrant**:
   ```bash
   docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
   ```
3. **Set environment variable**:
   ```bash
   export QDRANT_URL=http://localhost:6333
   export BOOMERANG_PROJECT_ID=my-project  # optional, for isolation
   ```
4. **Run ingest script**:
   ```bash
   npx boomerang-v2 migrate-memory --lancedb-uri ./memory_data --qdrant-url http://localhost:6333
   ```
5. **Verify migration**:
   ```bash
   npx boomerang-v2 verify-memory
   ```
6. **Remove old LanceDB data** (after confirming Qdrant has everything):
   ```bash
   rm -rf ./memory_data
   ```

### 6.3 Backward Compatibility

- **MemoryService fallback mode**: Already implemented. If Qdrant init fails, MemoryService enters fallback mode — `queryMemories()` returns `[]`, `addMemory()` logs warning. This prevents crashes during the transition period.
- **Graceful degradation**: boomerang-v2 continues to function without memory if Qdrant is unavailable.
- **SourceType mapping**: Old `conversation` entries map to `session` in Qdrant — the adapter handles bidirectional translation.

---

## 7. Testing Strategy

### 7.1 Tests to DELETE

| Test File | Reason |
|-----------|--------|
| `src/model/index.test.ts` | ModelManager deleted — rely on Super-Memory-TS tests |
| `tests/memory/database.test.ts` | LanceDBPool deleted |
| `tests/memory/operations.test.ts` | LanceDB operations deleted |
| `tests/memory/search.test.ts` | LanceDB search deleted |
| `tests/project-index/indexer.test.ts` | LanceDB indexer deleted |
| `tests/project-index/search.test.ts` | LanceDB project search deleted |
| `tests/project-index/chunker.test.ts` | If using Super-Memory-TS chunker |
| `tests/project-index/watcher.test.ts` | If using Super-Memory-TS watcher |

### 7.2 Tests to UPDATE

| Test File | Changes |
|-----------|---------|
| `src/memory-service.test.ts` | Update to mock Super-Memory-TS MemorySystem instead of LanceDB internals |
| `tests/memory-service/fallback.test.ts` | Verify fallback mode works with Qdrant connection failures |
| `tests/integration/memory-flow.test.ts` | Update to use real Super-Memory-TS with test Qdrant instance |
| `tests/integration/full-pipeline.test.ts` | Update imports, ensure orchestrator + memory integration works |
| `tests/mcp/server.test.ts` | Update server.ts tests to use wrapped memory |
| `src/project-index/index.test.ts` | If keeping this file, update to test Super-Memory-TS integration |

### 7.3 Tests to CREATE

| Test File | Purpose |
|-----------|---------|
| `src/memory/adapter.test.ts` | Unit tests for type conversion utilities (Date↔number, Float32Array↔number[]) |
| `src/memory/index.test.ts` | Unit tests for MemorySystem adapter — mock Super-Memory-TS, verify API contract |
| `tests/integration/super-memory-adapter.test.ts` | Integration test with real Qdrant (docker or testcontainer) |
| `tests/migration/ingest-script.test.ts` | Test ingest script with sample LanceDB data |
| `tests/memory/project-isolation.test.ts` | Verify projectId filtering works correctly |

### 7.4 Test Infrastructure

**Qdrant for testing**:
- Option A: `testcontainers` Node.js library to spin up Qdrant in Docker during tests
- Option B: Mock Qdrant client for unit tests (faster, no Docker needed)
- Option C: Use Super-Memory-TS's existing test patterns

**Recommendation**: Use Option B for unit tests (mock the Qdrant client or Super-Memory-TS's MemorySystem), Option A for integration tests.

---

## 8. Implementation Order

### Phase 1: Foundation (Risk: Low)
**Goal**: Establish dependency and adapter layer without touching legacy code.

1. **Add dependency**:
   - Update `boomerang-v2/package.json` with `@veedubin/super-memory-ts`
   - Run `npm install` or `bun install`

2. **Create adapter utilities** (`src/memory/adapter.ts`):
   - `adaptMemoryEntry(smtEntry): MemoryEntry` — Date→number, Float32Array→number[]
   - `toSmtMemoryEntryInput(entry): MemoryEntryInput` — number→Date, number[]→Float32Array
   - `mapSourceType(type): MemorySourceType` — boomerang→SMT mapping

3. **Create new MemorySystem wrapper** (`src/memory/index.ts` NEW version):
   - Import from `@veedubin/super-memory-ts`
   - Implement all public methods with adapter logic
   - Preserve singleton pattern (`getMemorySystem()`)
   - Add `saveContext()` / `getContext()` / `listSources()` on top of SMT APIs

4. **Preserve schema types** (`src/memory/schema.ts`):
   - Keep existing types for backward compatibility
   - Add `score?: number` to MemoryEntry to match SMT's approach

5. **Verify build compiles**:
   - `cd boomerang-v2 && npm run typecheck`
   - Fix any import errors

### Phase 2: Wire Core Services (Risk: Medium)
**Goal**: Update all callers to use new memory layer.

6. **Update MemoryService** (`src/memory-service.ts`):
   - Import new MemorySystem
   - Update `indexProject()` to use `ProjectIndexer` from Super-Memory-TS
   - Test fallback mode still works

7. **Update main entry point** (`src/index.ts`):
   - Change initialization to use Qdrant URL
   - Update env var reading (`QDRANT_URL` instead of `LANCEDB_URI`)

8. **Wire TUI hooks**:
   - `src/tui/hooks/useMemory.ts`: Replace mock with adapter
   - `src/tui/hooks/useSession.ts`: Replace mock with adapter, implement `getMemoriesBySource()`

9. **Update MCP server** (`src/server.ts`):
   - Use new MemorySystem
   - Add deprecation warning

10. **Run smoke tests**:
    - `npm run typecheck`
    - `npm run test -- src/memory-service.test.ts`

### Phase 3: Remove Legacy (Risk: Medium)
**Goal**: Delete LanceDB code and clean up.

11. **Delete LanceDB memory layer**:
    - `src/memory/database.ts`
    - `src/memory/operations.ts`
    - `src/memory/search.ts`
    - `src/memory/text-search.ts`

12. **Delete model layer**:
    - `src/model/index.ts`
    - `src/model/types.ts`

13. **Delete LanceDB project index**:
    - `src/project-index/indexer.ts`
    - `src/project-index/search.ts`
    - Evaluate `chunker.ts` and `watcher.ts`

14. **Remove LanceDB dependency** from `package.json`

15. **Verify build**:
    - `npm run typecheck`
    - `npm run build`

### Phase 4: Project Index Migration (Risk: Medium)
**Goal**: Ensure project indexing works with Super-Memory-TS.

16. **Update project-index exports** (`src/project-index/index.ts` if it exists):
    - Re-export from `@veedubin/super-memory-ts` where appropriate
    - Or update `src/memory-service.ts` to import directly from package

17. **Update MemoryService.projectIndex methods**:
    - `searchProject()` → delegate to `ProjectIndexer.search()`
    - `getFileContents()` → delegate to `ProjectIndexer.getFileContents()`
    - `indexProject()` → create `new ProjectIndexer(config, dbUri, projectId)`

18. **Test project indexing**:
    - Run indexer on a test project
    - Verify `searchProject()` returns results
    - Verify `getFileContents()` reconstructs files

### Phase 5: Ingest Script (Risk: Low)
**Goal**: Create migration tool for existing data.

19. **Create ingest script** (`scripts/migrate-lancedb-to-qdrant.ts`):
    - Implement LanceDB reader
    - Implement batch embedding regeneration
    - Implement Qdrant writer
    - Add progress logging and state tracking

20. **Test ingest script**:
    - Create sample LanceDB data
    - Run ingest
    - Verify counts match
    - Test `--resume` functionality

### Phase 6: Test Suite (Risk: Low)
**Goal**: Update all tests for new architecture.

21. **Delete obsolete tests**
22. **Write adapter unit tests**
23. **Write integration tests** with Qdrant
24. **Run full test suite**: `npm run test`

### Phase 7: Documentation (Risk: Low)
**Goal**: Update docs and release.

25. **Update README.md**:
    - Correct the false claim about integration
    - Document Qdrant setup
    - Document ingest script usage

26. **Update CHANGELOG.md**:
    - Document breaking changes
    - Document migration path

27. **Update AGENTS.md**:
    - Update architecture section
    - Update commands/env vars

28. **Bump version** (minor or major?):
    - This is a breaking change → bump to **v3.0.0**

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Dual ModelManager still causes VRAM issues | Low | High | **Delete boomerang-v2's model/ entirely** — verified no other callers exist |
| Type conversion bugs in adapter | Medium | Medium | Comprehensive unit tests for `adapter.ts`; property-by-property assertions |
| Qdrant unavailable at startup | Medium | High | MemoryService fallback mode already exists — returns empty results, logs warning |
| Ingest script fails on large datasets | Medium | High | Batch processing with state file; `--resume` flag; process in chunks of 500 |
| Project isolation leaks data | Low | High | Test `BOOMERANG_PROJECT_ID` filtering; verify payload indexes exist |
| TUI hooks break due to mock removal | Medium | Medium | Keep `setMemorySystem()` injection pattern; wire during TUI init |
| Super-Memory-TS version drift | Medium | Medium | Pin to `^2.3.7` in package.json; run integration tests on version bumps |
| Previous migration commit confusion | Low | Low | Document in CHANGELOG that this is the real integration; reference commits cd93abd and 418c5f2 |

---

## 10. Open Questions

1. **Should boomerang-v2's `src/server.ts` be removed entirely?**
   - If external users are expected to use `@veedubin/super-memory-ts` directly, boomerang-v2's server is redundant
   - **Recommendation**: Keep for one minor version with deprecation warning, then remove in v3.1.0

2. **Should chunker.ts and watcher.ts be kept or deleted?**
   - Need to audit if boomerang-v2 has custom chunking logic beyond Super-Memory-TS's
   - **Recommendation**: Try importing from Super-Memory-TS first; if APIs differ, create thin wrappers

3. **How to handle the `conversation` → `session` source type mapping for existing data?**
   - The ingest script should map `conversation` → `session` during migration
   - The adapter should handle bidirectional mapping for queries

4. **Should we expose Super-Memory-TS's `queryMemories` filter options to boomerang-v2 callers?**
   - Currently boomerang-v2 doesn't expose filtering; Super-Memory-TS supports `sourceType`, `sessionId`, `since` filters
   - **Recommendation**: Add optional filter param to `MemoryService.queryMemories()` as a non-breaking enhancement

---

## 11. Appendix: Directory Structure After Migration

```
boomerang-v2/src/
├── memory/
│   ├── index.ts          # MemorySystem adapter (wrapper)
│   ├── schema.ts         # Preserved types + conversion utils
│   └── adapter.ts        # NEW: Type conversion utilities
├── memory-service.ts     # Updated imports, same API
├── project-index/
│   ├── types.ts          # Kept for backward compat (re-export from SMT)
│   ├── chunker.ts        # KEEP or DELETE after audit
│   └── watcher.ts        # KEEP or DELETE after audit
├── model/                # DELETED
│   └── ...
├── tui/hooks/
│   ├── useMemory.ts      # Wired to real adapter
│   └── useSession.ts     # Wired to real adapter
├── server.ts             # Updated, deprecated
├── index.ts              # Updated init
├── orchestrator.ts       # No changes (uses MemoryService)
├── protocol/enforcer.ts  # No changes (uses MemoryService)
└── context/compactor.ts  # No changes (uses MemoryService)

scripts/
└── migrate-lancedb-to-qdrant.ts  # NEW: Ingest script
```

---

*End of Architectural Plan*
