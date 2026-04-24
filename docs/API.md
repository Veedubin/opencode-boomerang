# API Reference

Complete API documentation for Boomerang v2 components.

## MemorySystem

Singleton memory system for storing and retrieving memories with vector embeddings.

### Methods

#### `getInstance(): MemorySystem`

Get the MemorySystem singleton instance.

#### `initialize(dbUri?: string): Promise<void>`

Initialize the memory system. Must be called before any operations.

```typescript
const memory = MemorySystem.getInstance();
await memory.initialize('memory://');
```

**Throws:** `Error` if already initialized.

#### `isInitialized(): boolean`

Check if the system has been initialized.

#### `addMemory(entry): Promise<MemoryEntry>`

Add a new memory entry.

```typescript
const entry = await memory.addMemory({
  text: 'User preference: prefers dark mode',
  sourceType: 'manual',
  sourcePath: 'config://user',
  sessionId: 'session-123',
  metadataJson: '{"priority": "high"}'
});
```

**Parameters:**
- `entry` - Omit&lt;MemoryEntry, 'id' | 'vector' | 'timestamp' | 'contentHash'&gt;

**Returns:** Full `MemoryEntry` with generated ID, vector, and timestamp.

#### `getMemory(id: string): Promise<MemoryEntry | null>`

Get a memory entry by ID.

#### `deleteMemory(id: string): Promise<boolean>`

Delete a memory entry by ID. Returns `true` if deleted.

#### `listSources(sourceType?: SourceType): Promise<string[]>`

List unique source paths, optionally filtered.

```typescript
const sources = await memory.listSources('file');
```

#### `saveContext(sessionId: string, context: string): Promise<MemoryEntry>`

Save a context entry for a session.

#### `getContext(sessionId: string): Promise<MemoryEntry | null>`

Get the most recent context entry for a session.

#### `search(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]>`

Search memories using hybrid vector + text search.

```typescript
const results = await memory.search('project setup', {
  strategy: 'TIERED',
  topK: 10,
  threshold: 0.7
});
```

**Options:**
```typescript
interface SearchOptions {
  strategy: 'TIERED' | 'VECTOR_ONLY' | 'TEXT_ONLY';
  topK: number;
  threshold: number;
}
```

---

## Orchestrator

Task planning, dependency graph management, and agent assignment.

### Constructor

```typescript
const orchestrator = new Orchestrator(agents, memoryClient);
```

### Methods

#### `planTask(request: string): TaskGraph`

Parse a user request and create a task graph with agent assignments.

```typescript
const graph = orchestrator.planTask(
  'Write tests for auth module, then review the code'
);
// Returns TaskGraph with tasks and edges
```

#### `validateGraph(graph: TaskGraph): boolean`

Validate a task graph for:
- Cycles (using DFS)
- Missing dependencies
- Invalid agent assignments

#### `optimizeGraph(graph: TaskGraph): TaskGraph`

Optimize a task graph by:
- Removing transitive dependencies
- Sorting by dependency depth

#### `getExecutionOrder(graph: TaskGraph): Task[]`

Get topologically sorted tasks for execution.

#### `queryContext(request: string): Promise<MemoryEntry[]>`

Query memories for relevant context before planning.

#### `saveResults(results: TaskResult[]): Promise<void>`

Save task execution results to memory.

#### `setAutoMemory(enabled: boolean): void`

Enable/disable automatic memory integration.

### Types

```typescript
type TaskType = 'explore' | 'code' | 'test' | 'review' | 'write' | 'git' | 'general';

interface Task {
  id: string;
  type: TaskType;
  description: string;
  agent: string;
  dependencies: string[];
  status: TaskStatus;
  result?: TaskResult;
}

interface TaskGraph {
  tasks: Task[];
  edges: [from: string, to: string][];  // from depends on to
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}
```

---

## ProjectIndexer

Background indexing engine with queue system and file watching.

### Constructor

```typescript
const indexer = new ProjectIndexer(dbUri, rootPath, config);
```

### Methods

#### `start(): Promise<void>`

Start the indexer - initialize DB, load model, create watcher.

#### `stop(): Promise<void>`

Stop the indexer - close watcher, flush queue.

#### `indexFile(filePath: string): Promise<void>`

Index a single file. Uses hash-based change detection.

```typescript
await indexer.indexFile('/path/to/file.ts');
```

#### `removeFile(filePath: string): Promise<void>`

Remove a file and its chunks from the index.

#### `getStats(): IndexerStats`

Get indexer statistics.

```typescript
interface IndexerStats {
  totalFiles: number;
  totalChunks: number;
  lastIndexed: Date | null;
}
```

---

## MemoryClient

MCP client for memory operations via the MCP server protocol.

### Constructor

```typescript
const client = new MemoryClient();
```

### Methods

#### `connect(): Promise<void>`

Connect to the MCP server.

#### `disconnect(): Promise<void>`

Disconnect from the MCP server.

#### `isConnected(): boolean`

Check connection status.

#### `queryMemories(query: string, options?: QueryOptions): Promise<SearchResult[]>`

Query memories from the memory system.

```typescript
const results = await client.queryMemories('project settings', {
  limit: 10,
  strategy: 'tiered'
});
```

#### `addMemory(entry: { content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }>`

Add a memory entry.

#### `searchProject(query: string, topK?: number): Promise<ProjectChunk[]>`

Search project files for relevant content.

#### `indexProject(rootPath: string): Promise<void>`

Start indexing a project.

---

## Project Search

### `searchProject(query: string, topK?: number): Promise<ProjectSearchResult[]>`

Search indexed project chunks.

```typescript
interface ProjectSearchResult {
  filePath: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  score: number;
}
```

### `getFileChunks(filePath: string): Promise<ProjectChunk[]>`

Get all chunks for a specific file.

---

## File Chunker

### `chunkFile(filePath: string, content: string, config?: ChunkConfig): FileChunk[]`

Split a file into chunks with line number metadata.

```typescript
interface ChunkConfig {
  chunkSize: number;      // default: 512
  chunkOverlap: number;  // default: 50
}

interface FileChunk {
  content: string;
  lineStart: number;
  lineEnd: number;
  index: number;
}
```

---

## Model Manager

### `loadModel(modelName: string): Promise<void>`

Load an embedding model.

### `generateEmbedding(text: string, modelName?: string): Promise<number[]>`

Generate embeddings for text.

---

## Asset Loader

### `loadAgents(): AgentDefinition[]`

Load all agents from the `agents/` directory.

### `loadSkills(): SkillDefinition[]`

Load all skills from the `skills/` directory.

### `getAgent(name: string): AgentDefinition | undefined`

Get a specific agent by name.

### `getSkill(name: string): SkillDefinition | undefined`

Get a specific skill by name.

```typescript
interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
}

interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
}
```

---

## MCP Server Tools

The MCP server (`server.ts`) exposes these tools:

| Tool | Description | Parameters |
|------|-------------|------------|
| `query_memories` | Search memories | `query`, `strategy?`, `topK?`, `threshold?` |
| `add_memory` | Add memory | `text`, `sourceType?`, `sourcePath?`, `metadata?` |
| `search_project` | Search project | `query`, `topK?` |
| `index_project` | Index project | `rootPath` |
