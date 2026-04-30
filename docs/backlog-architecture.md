# Boomerang Backlog Architecture

> **Document Version**: 0.1.0  
> **Last Updated**: 2026-04-20  
> **Status**: Architecture Specification — Ready for Implementation  
> **Scope**: Backlog Items 8-12 from TASKS.md

---

## Table of Contents

1. [Overview](#overview)
2. [Item 8: Support for Additional LLM Providers](#item-8-support-for-additional-llm-providers)
3. [Item 9: Plugin Marketplace Integration](#item-9-plugin-marketplace-integration)
4. [Item 10: Agent Performance Metrics](#item-10-agent-performance-metrics)
5. [Item 11: Automatic Agent Routing Optimization](#item-11-automatic-agent-routing-optimization)
6. [Item 12: Multi-Project Workspace Support](#item-12-multi-project-workspace-support)
7. [Dependency Graph](#dependency-graph)
8. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## Overview

This document specifies the architecture for five major backlog items that extend Boomerang's capabilities beyond the current v0.3.0 implementation. Each section provides:

- **Problem Statement**: Why this feature is needed
- **Proposed Architecture**: High-level design with component diagrams
- **Key Components**: Specific modules, interfaces, and their responsibilities
- **Integration Points**: How the feature connects to existing Boomerang code
- **Implementation Roadmap**: Phased approach with concrete deliverables
- **Complexity & Dependencies**: Risk assessment and prerequisites

### Current System Context (v0.3.0)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOMERANG v0.3.0 CORE                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  index.ts   │  │orchestrator │  │ task-parser │             │
│  │  (Plugin    │──│    .ts      │──│    .ts      │             │
│  │   Entry)    │  │  (DAG +     │  │ (Agent      │             │
│  │             │  │  Execution) │  │  Assignment)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                  │                   │
│         ▼                ▼                  ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │task-executor│  │ session-    │  │   memory    │             │
│  │    .ts      │  │  state.ts   │  │    .ts      │             │
│  │(MODEL_ROUTING│  │ (In-Memory │  │ (super-mem  │             │
│  │   -static-) │  │   Store)    │  │  adapter)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                  │                   │
│         ▼                ▼                  ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   git.ts    │  │quality-gates│  │ middleware  │             │
│  │ (VCS Hooks) │  │    .ts      │  │   .ts       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Item 8: Support for Additional LLM Providers

### Problem Statement / Motivation

Currently, Boomerang hardcodes model routing in `task-executor.ts` via the `MODEL_ROUTING` map:

```typescript
export const MODEL_ROUTING: Record<string, string> = {
  orchestrator: "kimi-for-coding/k2.5",
  coder: "minimax/MiniMax-M2.7-highspeed",
  // ... etc
};
```

**Limitations:**
- Users cannot add new providers (e.g., Anthropic Claude, DeepSeek, local Ollama) without modifying source code
- No failover mechanism if a provider is unavailable
- No provider-specific configuration (API keys, temperature, context windows)
- No cost optimization — cannot route to cheaper models for simple tasks

### Proposed Architecture

Introduce a **Provider Adapter Pattern** with a registry-based configuration system.

```
┌─────────────────────────────────────────────────────────────────┐
│                  PROVIDER ADAPTER LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ProviderRegistry (singleton)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │  OpenAI     │  │  Anthropic  │  │   Local     │     │   │
│  │  │  Adapter    │  │  Adapter    │  │   Adapter   │     │   │
│  │  │  (gpt-5)    │  │  (claude-4) │  │  (ollama)   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Kimi      │  │   Google    │  │  DeepSeek   │     │   │
│  │  │  Adapter    │  │  Adapter    │  │  Adapter    │     │   │
│  │  │  (k2.5)     │  │ (gemini-3)  │  │  (v3)       │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ModelRouter (replaces MODEL_ROUTING)        │   │
│  │                                                          │   │
│  │   RouteRequest ──► Select Provider ──► Fallback Chain   │   │
│  │   (task, agent)     (cost, speed,    (if primary fails,  │   │
│  │                      quality prefs)    try next)         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ProviderConfig (from opencode.json)         │   │
│  │  {                                                        │   │
│  │    "provider": "openai",                                  │   │
│  │    "model": "gpt-5.4",                                    │   │
│  │    "apiKey": "${OPENAI_API_KEY}",                         │   │
│  │    "baseUrl": "https://api.openai.com/v1",                │   │
│  │    "temperature": 0.2,                                    │   │
│  │    "maxTokens": 8192,                                     │   │
│  │    "timeout": 30000                                       │   │
│  │  }                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components and Responsibilities

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| `LLMProvider` interface | `src/providers/adapter.ts` | Abstract interface: `generate()`, `stream()`, `embed()`, `getCapabilities()` |
| `ProviderRegistry` | `src/providers/registry.ts` | Singleton registry. `register()`, `get()`, `list()`, `healthCheck()` |
| `OpenAIProvider` | `src/providers/openai.ts` | OpenAI-compatible API adapter (covers OpenAI, DeepSeek, local proxies) |
| `AnthropicProvider` | `src/providers/anthropic.ts` | Native Anthropic Messages API adapter |
| `GoogleProvider` | `src/providers/google.ts` | Google Gemini API adapter |
| `KimiProvider` | `src/providers/kimi.ts` | Moonshot Kimi API adapter |
| `LocalProvider` | `src/providers/local.ts` | Ollama / llama.cpp / vLLM adapter |
| `ModelRouter` | `src/providers/router.ts` | Replaces `MODEL_ROUTING`. `route(task, preferences) → ProviderConfig` |
| `FallbackChain` | `src/providers/fallback.ts` | Executes primary provider, falls back to secondary on failure |
| `ProviderConfigSchema` | `src/providers/config.ts` | Zod schema for provider configuration validation |

### Integration Points with Existing System

| Existing File | Integration | Change Type |
|---------------|-------------|-------------|
| `src/task-executor.ts` | Replace `MODEL_ROUTING` with `ModelRouter.resolve(agent, task)` | **Breaking** |
| `src/types.ts` | Add `ProviderConfig`, `LLMProvider` interface, `ModelCapabilities` types | **Additive** |
| `src/index.ts` | Load provider configs from `opencode.json`, initialize registry on plugin startup | **Additive** |
| `src/orchestrator.ts` | Pass provider preferences through `OrchestratorContext` | **Minor** |

#### Pseudocode: ModelRouter Integration

```typescript
// src/providers/router.ts
export class ModelRouter {
  private registry: ProviderRegistry;
  private fallbackChain: FallbackChain;

  resolve(agent: AgentType, task: Task, preferences?: RoutingPreferences): ProviderConfig {
    // 1. Get agent's default provider from config
    const defaultProvider = config.agents[agent]?.provider || "kimi";

    // 2. Check provider health
    if (!this.registry.isHealthy(defaultProvider)) {
      return this.fallbackChain.next(defaultProvider);
    }

    // 3. Apply task-specific routing rules
    if (task.complexity === "simple" && preferences?.costOptimize) {
      return this.findCheapestProvider(agent);
    }

    return this.registry.get(defaultProvider).getConfig();
  }
}

// src/task-executor.ts (modified)
export async function executeTaskInSession(
  ctx: OrchestratorContext,
  task: TaskWithAgent,
  model: string  // deprecated, use router instead
): Promise<TaskResult> {
  const providerConfig = ctx.modelRouter.resolve(task.agent, task);
  const provider = ctx.providerRegistry.get(providerConfig.provider);
  // ... execute with provider
}
```

### Implementation Roadmap

#### Phase 1: Core Adapter Infrastructure (1-2 weeks)
- [ ] Define `LLMProvider` interface with `generate()`, `stream()`, `embed()`
- [ ] Implement `ProviderRegistry` singleton with `register()` / `get()`
- [ ] Create `ProviderConfig` Zod schema
- [ ] Add provider loading from `opencode.json` in `index.ts`

#### Phase 2: Provider Adapters (2-3 weeks)
- [ ] Implement `OpenAIProvider` (covers OpenAI, DeepSeek, local proxies)
- [ ] Implement `AnthropicProvider`
- [ ] Implement `GoogleProvider`
- [ ] Implement `LocalProvider` (Ollama)
- [ ] Implement `KimiProvider`

#### Phase 3: Router & Fallback (1 week)
- [ ] Implement `ModelRouter` to replace `MODEL_ROUTING`
- [ ] Implement `FallbackChain` with configurable retry logic
- [ ] Add health check polling for providers
- [ ] Write migration guide for existing configs

#### Phase 4: Testing & Docs (1 week)
- [ ] Unit tests for each provider adapter
- [ ] Integration tests with mocked LLM APIs
- [ ] Update README.md with provider configuration examples
- [ ] Performance benchmarks across providers

### Estimated Complexity

**Medium-High**

- Multiple external API integrations with different authentication patterns
- Need to handle streaming, error codes, rate limiting per provider
- Backward compatibility concerns with existing `MODEL_ROUTING`
- Testing requires API keys for each provider

### Dependencies

| Depends On | Reason |
|------------|--------|
| None | This is foundational infrastructure |
| **Blocks** | Item 11 (Automatic Agent Routing) — more providers = more routing options |

---

## Item 9: Plugin Marketplace Integration

### Problem Statement / Motivation

Currently, Boomerang plugins are distributed as tar.gz files with manual installation:

```bash
# Manual install today
pip install opencode-boomerang
# Then manually edit opencode.json
```

**Limitations:**
- No discovery mechanism for community-contributed agents/skills
- No versioning or update notifications for installed plugins
- No dependency resolution between plugins
- No trust/verification system for third-party plugins
- Installation requires manual file editing

### Proposed Architecture

A decentralized marketplace system with a central registry and local package manager.

```
┌─────────────────────────────────────────────────────────────────┐
│                  MARKETPLACE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MARKETPLACE REGISTRY (Remote)               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Plugin    │  │   Plugin    │  │   Plugin    │     │   │
│  │  │   Manifest  │  │   Manifest  │  │   Manifest  │     │   │
│  │  │   (JSON)    │  │   (JSON)    │  │   (JSON)    │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                          │   │
│  │  Registry API:                                           │   │
│  │    GET /plugins          → list all                      │   │
│  │    GET /plugins/:name    → manifest + download URL       │   │
│  │    GET /plugins/search   → semantic search               │   │
│  │    GET /versions/:name   → version history               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ HTTPS                             │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              LOCAL MARKETPLACE CLIENT                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Search    │  │   Install   │  │   Update    │     │   │
│  │  │   Engine    │  │   Manager   │  │   Checker   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Verify    │  │  Dependency │  │   Trust     │     │   │
│  │  │   (SHA256)  │  │  Resolver   │  │   Store     │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PLUGIN MANIFEST FORMAT                      │   │
│  │  {                                                        │   │
│  │    "name": "boomerang-aws",                               │   │
│  │    "version": "1.2.0",                                    │   │
│  │    "description": "AWS deployment agents",                │   │
│  │    "author": "@johndoe",                                  │   │
│  │    "license": "MIT",                                      │   │
│  │    "agents": ["aws-deploy", "aws-monitor"],               │   │
│  │    "skills": ["boomerang-aws-deploy"],                    │   │
│  │    "dependencies": {                                      │   │
│  │      "boomerang": ">=0.3.0"                               │   │
│  │    },                                                     │   │
│  │    "entry": "dist/index.js",                              │   │
│  │    "checksum": "sha256:abc123..."                         │   │
│  │  }                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components and Responsibilities

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| `MarketplaceClient` | `src/marketplace/client.ts` | HTTP client for registry API. `search()`, `getManifest()`, `download()` |
| `PluginManifest` | `src/marketplace/manifest.ts` | Type definition + Zod schema for plugin manifests |
| `InstallManager` | `src/marketplace/installer.ts` | Downloads, verifies checksums, extracts to `.opencode/plugins/` |
| `DependencyResolver` | `src/marketplace/deps.ts` | Resolves plugin dependency graph, detects conflicts |
| `TrustStore` | `src/marketplace/trust.ts` | Manages trusted authors, signature verification |
| `UpdateChecker` | `src/marketplace/update.ts` | Polls registry for updates, shows changelogs |
| `PluginCLI` | `src/marketplace/cli.ts` | Commands: `boomerang plugin install`, `search`, `update`, `list` |
| `RegistryAPI` | `src/marketplace/registry.ts` | Abstract registry interface (allows private registries) |

### Integration Points with Existing System

| Existing File | Integration | Change Type |
|---------------|-------------|-------------|
| `src/index.ts` | Add marketplace CLI commands to plugin tools | **Additive** |
| `.opencode/opencode.json` | New `plugins` section for installed marketplace plugins | **Additive** |
| `src/types.ts` | Add `PluginManifest`, `InstalledPlugin` types | **Additive** |
| Plugin loader | Extend to load marketplace plugins alongside built-in | **Minor** |

#### Pseudocode: Plugin Installation Flow

```typescript
// src/marketplace/installer.ts
export class InstallManager {
  async install(pluginName: string, version?: string): Promise<InstallResult> {
    // 1. Fetch manifest from registry
    const manifest = await this.client.getManifest(pluginName, version);

    // 2. Check compatibility
    if (!this.isCompatible(manifest.dependencies)) {
      throw new IncompatiblePluginError(manifest);
    }

    // 3. Resolve dependencies
    const deps = await this.resolver.resolve(manifest.dependencies);
    for (const dep of deps) {
      await this.install(dep.name, dep.version);
    }

    // 4. Download and verify
    const archive = await this.client.download(manifest.downloadUrl);
    if (!this.verifyChecksum(archive, manifest.checksum)) {
      throw new VerificationError("Checksum mismatch");
    }

    // 5. Extract to .opencode/plugins/
    const installPath = path.join(this.pluginsDir, manifest.name);
    await this.extract(archive, installPath);

    // 6. Update opencode.json
    await this.registerPlugin(manifest);

    return { success: true, manifest, installPath };
  }
}

// New tool: boomerang_plugin_install
boomerang_plugin_install: tool({
  description: "Install a plugin from the marketplace",
  args: {
    name: tool.schema.string(),
    version: tool.schema.string().optional(),
  },
  async execute(args) {
    const result = await installManager.install(args.name, args.version);
    return `Installed ${result.manifest.name}@${result.manifest.version}`;
  },
}),
```

### Implementation Roadmap

#### Phase 1: Local Infrastructure (2 weeks)
- [ ] Define `PluginManifest` schema with validation
- [ ] Implement `InstallManager` with download, verify, extract
- [ ] Implement `DependencyResolver` for simple semver matching
- [ ] Add `boomerang plugin install/uninstall/list` tools
- [ ] Store installed plugins in `opencode.json`

#### Phase 2: Registry Client (1-2 weeks)
- [ ] Implement `MarketplaceClient` with caching
- [ ] Add `boomerang plugin search` with keyword/semantic search
- [ ] Implement `UpdateChecker` with changelog display
- [ ] Add version pinning and rollback support

#### Phase 3: Trust & Security (1-2 weeks)
- [ ] Implement `TrustStore` with author verification
- [ ] Add checksum verification for all downloads
- [ ] Support GPG signature verification (optional)
- [ ] Add plugin sandboxing (restricted file access)

#### Phase 4: Public Registry (Optional — 2-3 weeks)
- [ ] Deploy registry server (can be static JSON on GitHub initially)
- [ ] Build plugin submission workflow
- [ ] Add rating/review system
- [ ] CI pipeline for automatic manifest validation

### Estimated Complexity

**Medium**

- Core install/uninstall logic is straightforward
- Dependency resolution can become complex (npm-style diamond dependencies)
- Security considerations require careful design
- Public registry is optional and can be deferred

### Dependencies

| Depends On | Reason |
|------------|--------|
| None | Marketplace is a parallel concern |
| **Blocks** | None directly, but enables community ecosystem growth |

---

## Item 10: Agent Performance Metrics

### Problem Statement / Motivation

Currently, Boomerang only tracks basic execution time in `TaskResult`:

```typescript
export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  executionTime: number;  // ← only metric
}
```

**Limitations:**
- No visibility into which agents perform best for which task types
- No tracking of token usage, cost, or latency per agent
- No success/failure rate trends over time
- No quality metrics (did the generated code pass review?)
- No ability to detect agent degradation or model drift

### Proposed Architecture

A metrics pipeline that collects, stores, and visualizes agent performance data.

```
┌─────────────────────────────────────────────────────────────────┐
│                  METRICS PIPELINE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              COLLECTION LAYER (Event-Driven)             │   │
│  │                                                          │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │   │  Task    │  │  Model   │  │  Quality │  │  Cost  │ │   │
│  │   │  Start   │  │  Call    │  │  Gate    │  │ Tracker│ │   │
│  │   │  Event   │  │  Event   │  │  Event   │  │ Event  │ │   │
│  │   └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │   │
│  │        └─────────────┴─────────────┴────────────┘      │   │
│  │                      │                                  │   │
│  │                      ▼                                  │   │
│  │              ┌───────────────┐                          │   │
│  │              │ MetricsBuffer │ (in-memory, flush every  │   │
│  │              │  (ring buffer)│  5s or 100 events)       │   │
│  │              └───────┬───────┘                          │   │
│  │                      │                                  │   │
│  └──────────────────────┼──────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              STORAGE LAYER                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐              │   │
│  │  │   Time-Series   │  │   Aggregated    │              │   │
│  │  │   (per event)   │  │   (hourly/daily)│              │   │
│  │  │                 │  │                 │              │   │
│  │  │  - timestamp    │  │  - successRate  │              │   │
│  │  │  - agent        │  │  - avgLatency   │              │   │
│  │  │  - model        │  │  - totalCost    │              │   │
│  │  │  - latencyMs    │  │  - tokenUsage   │              │   │
│  │  │  - tokensIn/Out │  │  - taskCount    │              │   │
│  │  │  - costUsd      │  │                 │              │   │
│  │  │  - success      │  │                 │              │   │
│  │  │  - errorType    │  │                 │              │   │
│  │  └─────────────────┘  └─────────────────┘              │   │
│  │                                                          │   │
│  │  Storage backends: JSON file (default) or ClickHouse     │   │
│  │  (for high-volume deployments)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              QUERY & VISUALIZATION                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Agent     │  │   Cost      │  │   Health    │     │   │
│  │  │   Dashboard │  │   Report    │  │   Alerts    │     │   │
│  │  │   (CLI)     │  │   (CLI)     │  │   (CLI)     │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components and Responsibilities

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| `MetricsCollector` | `src/metrics/collector.ts` | Central event bus. `emit(event)`, `on(event, handler)` |
| `MetricsBuffer` | `src/metrics/buffer.ts` | Ring buffer for batching events before storage |
| `MetricsStore` | `src/metrics/store.ts` | Abstract storage interface. `write()`, `query()`, `aggregate()` |
| `JsonFileStore` | `src/metrics/stores/json.ts` | Default implementation: stores in `.opencode/boomerang-metrics.jsonl` |
| `ClickHouseStore` | `src/metrics/stores/clickhouse.ts` | Optional high-volume time-series backend |
| `AgentDashboard` | `src/metrics/dashboard.ts` | CLI dashboard: `boomerang metrics dashboard --agent=coder` |
| `CostTracker` | `src/metrics/cost.ts` | Calculates cost per call based on provider pricing tables |
| `HealthMonitor` | `src/metrics/health.ts` | Detects anomalies (spike in errors, latency degradation) |
| `MetricsReporter` | `src/metrics/reporter.ts` | Generates periodic reports (daily/weekly summaries) |

### Integration Points with Existing System

| Existing File | Integration | Change Type |
|---------------|-------------|-------------|
| `src/task-executor.ts` | Emit `task.start`, `task.complete`, `task.error` events around `executeTaskInSession()` | **Additive** |
| `src/orchestrator.ts` | Emit `execution.phase.start`, `execution.phase.complete` events | **Additive** |
| `src/quality-gates.ts` | Emit `quality.gate.passed`, `quality.gate.failed` events | **Additive** |
| `src/index.ts` | Initialize metrics collector on plugin startup, register tools | **Additive** |
| `src/types.ts` | Add `MetricsEvent`, `AgentMetrics`, `CostEstimate` types | **Additive** |
| `src/providers/*.ts` (Item 8) | Emit `model.call` events with token usage | **Depends on Item 8** |

#### Pseudocode: Metrics Collection Integration

```typescript
// src/metrics/collector.ts
export class MetricsCollector {
  private buffer: MetricsBuffer;
  private store: MetricsStore;

  emit(event: MetricsEvent) {
    this.buffer.push({
      ...event,
      timestamp: Date.now(),
      sessionId: getCurrentSessionId(),
    });
  }

  async flush() {
    const events = this.buffer.drain();
    await this.store.writeBatch(events);
  }
}

// src/task-executor.ts (instrumented)
export async function executeTaskInSession(
  ctx: OrchestratorContext,
  task: TaskWithAgent,
  model: string
): Promise<TaskResult> {
  const startTime = Date.now();
  metrics.emit({ type: "task.start", agent: task.agent, taskId: task.id });

  try {
    const result = await ctx.client.session.prompt({ ... });
    const latency = Date.now() - startTime;

    // Extract token usage from provider response (if available)
    const tokensIn = result.usage?.prompt_tokens || 0;
    const tokensOut = result.usage?.completion_tokens || 0;

    metrics.emit({
      type: "task.complete",
      agent: task.agent,
      taskId: task.id,
      latency,
      tokensIn,
      tokensOut,
      success: true,
    });

    return { taskId: task.id, success: true, output: result?.content, executionTime: latency };
  } catch (error) {
    metrics.emit({
      type: "task.error",
      agent: task.agent,
      taskId: task.id,
      errorType: error.name,
      errorMessage: error.message,
    });
    return { taskId: task.id, success: false, error: error.message, executionTime: Date.now() - startTime };
  }
}

// New tool: boomerang_metrics_dashboard
boomerang_metrics_dashboard: tool({
  description: "Show agent performance dashboard",
  args: {
    agent: tool.schema.string().optional(),
    period: tool.schema.enum(["hour", "day", "week"]).default("day"),
  },
  async execute(args) {
    const metrics = await store.query({
      agent: args.agent,
      since: getPeriodStart(args.period),
    });
    return formatDashboard(metrics);
  },
}),
```

### Implementation Roadmap

#### Phase 1: Event Infrastructure (1 week)
- [ ] Implement `MetricsCollector` with typed event system
- [ ] Implement `MetricsBuffer` (ring buffer with configurable size)
- [ ] Define all event types: `task.start`, `task.complete`, `task.error`, `model.call`, `quality.gate.*`
- [ ] Integrate event emission into `task-executor.ts` and `orchestrator.ts`

#### Phase 2: Storage Layer (1 week)
- [ ] Implement `MetricsStore` interface
- [ ] Implement `JsonFileStore` (default, append-only JSONL)
- [ ] Add periodic flush (every 5 seconds or 100 events)
- [ ] Add data retention policy (keep 30 days by default)

#### Phase 3: Cost Tracking (1 week)
- [ ] Build pricing tables for each provider/model
- [ ] Implement `CostTracker` that calculates per-call cost from token usage
- [ ] Add cost aggregation (per agent, per session, per day)
- [ ] Emit cost alerts when daily budget exceeded

#### Phase 4: Dashboard & Alerts (1-2 weeks)
- [ ] Implement `AgentDashboard` CLI tool
- [ ] Add `boomerang metrics dashboard` command
- [ ] Add `boomerang metrics report --period=week` command
- [ ] Implement `HealthMonitor` with anomaly detection
- [ ] Add alerting (log warnings when success rate drops below threshold)

### Estimated Complexity

**Medium**

- Event system is straightforward
- Storage abstraction allows simple default (JSONL file)
- Cost tracking requires maintaining pricing tables
- Dashboard is CLI-based, no web UI needed

### Dependencies

| Depends On | Reason |
|------------|--------|
| Item 8 (LLM Providers) | Token usage and cost data require provider-specific APIs |
| **Blocks** | Item 11 (Automatic Agent Routing) — requires metrics to optimize |

---

## Item 11: Automatic Agent Routing Optimization

### Problem Statement / Motivation

Currently, agent assignment is static and rule-based in `task-parser.ts`:

```typescript
export function assignAgentsToTasks(tasks: Task[]): TaskWithAgent[] {
  return tasks.map(task => ({
    ...task,
    agent: inferAgentFromDescription(task.description),  // simple keyword matching
  }));
}
```

**Limitations:**
- No learning from past performance — a coder agent that consistently produces buggy code for "refactor" tasks is still assigned
- No adaptation to user preferences — if user always rejects architect suggestions, system doesn't learn
- No cost-aware routing — always uses the most expensive model regardless of task complexity
- No A/B testing capability for new agents or models

### Proposed Architecture

A reinforcement learning-inspired routing system that uses historical performance to optimize agent selection.

```
┌─────────────────────────────────────────────────────────────────┐
│              INTELLIGENT ROUTING ENGINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ROUTING DECISION FLOW                       │   │
│  │                                                          │   │
│  │   Task Description + Context                             │   │
│  │        │                                                 │   │
│  │        ▼                                                 │   │
│  │   ┌────────────┐    ┌────────────┐    ┌────────────┐   │   │
│  │   │  Feature   │───►│  Router    │───►│  Selected  │   │   │
│  │   │  Extractor │    │  Model     │    │  Agent +   │   │   │
│  │   │            │    │  (scoring) │    │  Model     │   │   │
│  │   └────────────┘    └─────┬──────┘    └────────────┘   │   │
│  │                           │                             │   │
│  │              ┌────────────┼────────────┐               │   │
│  │              ▼            ▼            ▼               │   │
│  │   ┌─────────────────────────────────────────┐         │   │
│  │   │         SCORING FACTORS                  │         │   │
│  │   │  • Historical success rate (40%)         │         │   │
│  │   │  • Average latency (20%)                 │         │   │
│  │   │  • Estimated cost (15%)                  │         │   │
│  │   │  • Task type affinity (15%)              │         │   │
│  │   │  • User preference score (10%)           │         │   │
│  │   └─────────────────────────────────────────┘         │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              FEEDBACK LOOP                               │   │
│  │                                                          │   │
│  │   Execution Result ──► Quality Gate ──► User Feedback   │   │
│  │        │                      │                │         │   │
│  │        └──────────────────────┴────────────────┘         │   │
│  │                       │                                  │   │
│  │                       ▼                                  │   │
│  │              ┌─────────────────┐                         │   │
│  │              │  PerformanceDB  │  (per agent-task pair)  │   │
│  │              │  ─────────────  │                         │   │
│  │              │  successRate    │                         │   │
│  │              │  avgLatency     │                         │   │
│  │              │  costPerTask    │                         │   │
│  │              │  userRating     │                         │   │
│  │              └─────────────────┘                         │   │
│  │                       │                                  │   │
│  │                       ▼                                  │   │
│  │              ┌─────────────────┐                         │   │
│  │              │  RouteOptimizer │  (periodic retraining)  │   │
│  │              │  (weekly batch) │                         │   │
│  │              └─────────────────┘                         │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components and Responsibilities

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| `FeatureExtractor` | `src/routing/features.ts` | Extracts features from task description: complexity, domain, file types, keywords |
| `RouterModel` | `src/routing/router.ts` | Core scoring engine. `score(agent, taskFeatures) → float[0-1]` |
| `PerformanceDB` | `src/routing/performance.ts` | Stores per-agent-task performance metrics. `record()`, `query()`, `aggregate()` |
| `RouteOptimizer` | `src/routing/optimizer.ts` | Periodic batch optimizer that retrains scoring weights from PerformanceDB |
| `UserPreferenceTracker` | `src/routing/preferences.ts` | Tracks user acceptance/rejection of agent outputs per task type |
| `ExplorationStrategy` | `src/routing/explore.ts` | Epsilon-greedy exploration: occasionally try suboptimal agents to gather data |
| `RoutingConfig` | `src/routing/config.ts` | User-configurable routing strategy: `performance`, `cost`, `balanced` |

### Integration Points with Existing System

| Existing File | Integration | Change Type |
|---------------|-------------|-------------|
| `src/task-parser.ts` | Replace `assignAgentsToTasks()` with `RouterModel.select()` | **Breaking** |
| `src/task-executor.ts` | Return detailed result metadata for feedback loop | **Additive** |
| `src/orchestrator.ts` | Call feedback recording after quality gates | **Additive** |
| `src/metrics/*` (Item 10) | Read historical metrics from metrics store | **Depends on Item 10** |
| `src/providers/*` (Item 8) | Consider provider availability and cost in routing | **Depends on Item 8** |

#### Pseudocode: Intelligent Routing Integration

```typescript
// src/routing/router.ts
export class RouterModel {
  private performanceDB: PerformanceDB;
  private config: RoutingConfig;

  async select(task: Task): Promise<AgentSelection> {
    const features = extractFeatures(task);
    const candidates = this.getCandidateAgents(task);

    // Score each candidate
    const scores = await Promise.all(
      candidates.map(async (agent) => ({
        agent,
        score: await this.score(agent, features),
      }))
    );

    // Epsilon-greedy: sometimes explore suboptimal choices
    if (Math.random() < this.config.explorationRate) {
      return this.explore(scores);
    }

    // Exploit: pick highest score
    return scores.reduce((best, current) =>
      current.score > best.score ? current : best
    );
  }

  private async score(agent: AgentType, features: TaskFeatures): Promise<number> {
    const perf = await this.performanceDB.get(agent, features.taskType);

    // Weighted scoring (weights configurable)
    return (
      perf.successRate * this.config.weights.success +
      (1 / (1 + perf.avgLatency / 1000)) * this.config.weights.latency +
      (1 / (1 + perf.avgCost)) * this.config.weights.cost +
      perf.typeAffinity * this.config.weights.affinity +
      perf.userPreference * this.config.weights.preference
    );
  }
}

// src/routing/feedback.ts
export class FeedbackLoop {
  async record(task: Task, result: TaskResult, qualityResult: QualityGateSummary) {
    // Update PerformanceDB with outcome
    await this.performanceDB.record({
      agent: task.agent,
      taskType: task.type,
      success: result.success && qualityResult.allPassed,
      latency: result.executionTime,
      cost: result.costEstimate,
      timestamp: Date.now(),
    });

    // Decay old records (exponential decay)
    await this.performanceDB.decay(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
}

// src/task-parser.ts (modified)
export async function assignAgentsToTasks(
  tasks: Task[],
  router: RouterModel
): Promise<TaskWithAgent[]> {
  return Promise.all(
    tasks.map(async (task) => ({
      ...task,
      agent: (await router.select(task)).agent,
    }))
  );
}
```

### Implementation Roadmap

#### Phase 1: Performance Database (1 week)
- [ ] Implement `PerformanceDB` with SQLite backend
- [ ] Schema: `agent_task_performance(agent, task_type, success_rate, avg_latency, avg_cost, sample_count, last_updated)`
- [ ] Add `record()`, `query()`, `aggregate()`, `decay()` methods

#### Phase 2: Feature Extraction (1 week)
- [ ] Implement `FeatureExtractor` with NLP heuristics
- [ ] Task types: `coding`, `testing`, `architecture`, `research`, `documentation`, `refactoring`, `debugging`
- [ ] Complexity scoring: word count, keyword density, file references

#### Phase 3: Router Engine (1-2 weeks)
- [ ] Implement `RouterModel` with weighted scoring
- [ ] Add epsilon-greedy exploration strategy
- [ ] Implement `RoutingConfig` with strategy presets: `performance`, `cost`, `balanced`, `speed`
- [ ] Replace static `assignAgentsToTasks()` with router

#### Phase 4: Feedback Loop (1 week)
- [ ] Implement `FeedbackLoop` that records outcomes after execution
- [ ] Integrate with quality gates to determine "success"
- [ ] Add user preference tracking (implicit: did user accept/reject output?)
- [ ] Implement weekly `RouteOptimizer` batch job

#### Phase 5: A/B Testing (Optional — 1 week)
- [ ] Add experiment framework for testing new agents
- [ ] Route 10% of traffic to experimental agent, compare performance

### Estimated Complexity

**High**

- Requires Items 8 and 10 as prerequisites
- Scoring model needs careful tuning to avoid feedback loops
- Exploration vs exploitation tradeoff requires monitoring
- User preference tracking is subtle (implicit signals)

### Dependencies

| Depends On | Reason |
|------------|--------|
| Item 8 (LLM Providers) | Need provider cost and availability data for routing |
| Item 10 (Metrics) | Historical success rates, latency, cost all come from metrics |
| **Blocks** | None directly, but enables significant efficiency gains |

---

## Item 12: Multi-Project Workspace Support

### Problem Statement / Motivation

Currently, Boomerang operates on a single directory context:

```typescript
export interface OrchestratorContext {
  sessionId: string;
  directory: string;  // ← single project only
  worktree?: string;
  client: any;
}
```

**Limitations:**
- Cannot orchestrate changes across multiple related repositories (e.g., frontend + backend + shared library)
- Each project needs separate OpenCode session — context not shared
- No way to plan tasks that span projects (e.g., "update API in backend and regenerate client in frontend")
- Super-memory is global, but project-specific context is isolated per session

### Proposed Architecture

A workspace abstraction that manages multiple projects with cross-project dependency resolution.

```
┌─────────────────────────────────────────────────────────────────┐
│                  WORKSPACE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WORKSPACE MANAGER                           │   │
│  │                                                          │   │
│  │   Workspace: "my-microservices"                          │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │   │  Project A  │  │  Project B  │  │  Project C  │     │   │
│  │   │  (frontend) │  │  (backend)  │  │  (shared)   │     │   │
│  │   │  /web-app   │  │  /api-srv   │  │  /lib-core  │     │   │
│  │   │             │  │             │  │             │     │   │
│  │   │ • agents/   │  │ • agents/   │  │ • agents/   │     │   │
│  │   │ • skills/   │  │ • skills/   │  │ • skills/   │     │   │
│  │   │ • git repo  │  │ • git repo  │  │ • git repo  │     │   │
│  │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │   │
│  │          │                │                │             │   │
│  │          └────────────────┼────────────────┘             │   │
│  │                           │                              │   │
│  │                    Cross-Project                         │   │
│  │                    Dependencies                          │   │
│  │                    (lib-core → api-srv → web-app)        │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CROSS-PROJECT DAG                           │   │
│  │                                                          │   │
│  │   Task: "Update auth API and regenerate client SDK"      │   │
│  │                                                          │   │
│  │   Phase 1 (sequential):                                  │   │
│  │     ┌─────────┐                                          │   │
│  │     │ lib-core│  Update auth types                       │   │
│  │     └────┬────┘                                          │   │
│  │          │                                                │   │
│  │          ▼                                                │   │
│  │   Phase 2 (parallel):                                    │   │
│  │     ┌─────────┐     ┌─────────┐                          │   │
│  │     │api-srv  │     │web-app  │  Update API + regen SDK  │   │
│  │     │(depends │     │(depends │  (can run in parallel    │   │
│  │     │ on lib)│     │ on api) │   after lib updated)     │   │
│  │     └─────────┘     └─────────┘                          │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CONTEXT ROUTER                              │   │
│  │                                                          │   │
│  │   When agent runs for Project A:                         │   │
│  │     • Directory = /workspace/web-app                     │   │
│  │     • Super-memory queries scoped to "project:web-app"   │   │
│  │     • Git operations target web-app repo                 │   │
│  │                                                          │   │
│  │   When orchestrator plans cross-project:                 │   │
│  │     • Memory queries include all projects                │   │
│  │     • Git check runs on all dirty repos                  │   │
│  │     • Quality gates run per-project                      │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components and Responsibilities

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| `WorkspaceManager` | `src/workspace/manager.ts` | Manages workspace lifecycle. `create()`, `addProject()`, `removeProject()`, `getProjects()` |
| `Project` | `src/workspace/project.ts` | Project model: name, path, git remote, dependencies, agent configs |
| `ProjectRegistry` | `src/workspace/registry.ts` | Persists workspace configuration to `.opencode/workspace.json` |
| `CrossProjectDAG` | `src/workspace/dag.ts` | Extends DAG builder to handle inter-project dependencies |
| `ContextRouter` | `src/workspace/router.ts` | Routes agent contexts to correct project directory and memory scope |
| `WorkspaceSession` | `src/workspace/session.ts` | Multi-project session state. Tracks dirty repos, pending tasks per project |
| `SyncManager` | `src/workspace/sync.ts` | Handles cross-repo sync (e.g., after lib update, bump version in dependents) |
| `WorkspaceConfig` | `src/workspace/config.ts` | Zod schema for workspace configuration |

### Integration Points with Existing System

| Existing File | Integration | Change Type |
|---------------|-------------|-------------|
| `src/types.ts` | Add `Workspace`, `Project`, `WorkspaceConfig` types | **Additive** |
| `src/session-state.ts` | Extend to support multi-project sessions | **Breaking** |
| `src/orchestrator.ts` | Accept `Workspace` instead of single directory | **Breaking** |
| `src/task-parser.ts` | Extend DAG builder with cross-project edges | **Minor** |
| `src/task-executor.ts` | Route agent context to correct project | **Minor** |
| `src/git.ts` | Support multiple git repos in workspace | **Minor** |
| `src/memory.ts` | Scope memory queries by project | **Minor** |
| `src/index.ts` | Add workspace management tools | **Additive** |

#### Pseudocode: Workspace Integration

```typescript
// src/workspace/manager.ts
export class WorkspaceManager {
  private registry: ProjectRegistry;
  private sessions: Map<string, WorkspaceSession>;

  async createWorkspace(name: string, rootPath: string): Promise<Workspace> {
    const workspace: Workspace = {
      name,
      rootPath,
      projects: [],
      config: { defaultAgentConfig: DEFAULT_CONFIG },
    };
    await this.registry.save(workspace);
    return workspace;
  }

  async addProject(workspaceName: string, project: Project): Promise<void> {
    const workspace = await this.registry.load(workspaceName);

    // Validate project path exists and is a git repo
    await this.validateProject(project);

    // Detect dependencies from package.json / pyproject.toml / Cargo.toml
    project.dependencies = await this.detectDependencies(project);

    workspace.projects.push(project);
    await this.registry.save(workspace);
  }
}

// src/workspace/dag.ts
export function buildCrossProjectDAG(
  tasks: TaskWithAgent[],
  workspace: Workspace
): DAG {
  const dag = buildDAG(tasks);

  // Add cross-project dependency edges
  for (const task of tasks) {
    const project = workspace.projects.find(p => p.name === task.project);
    for (const dep of project?.dependencies || []) {
      const depTasks = tasks.filter(t => t.project === dep.name);
      for (const depTask of depTasks) {
        dag.edges.push({ from: depTask.id, to: task.id });
      }
    }
  }

  return dag;
}

// src/workspace/router.ts
export class ContextRouter {
  route(agent: AgentType, task: Task, workspace: Workspace): OrchestratorContext {
    const project = workspace.projects.find(p => p.name === task.project);
    if (!project) throw new ProjectNotFoundError(task.project);

    return {
      sessionId: task.sessionId,
      directory: project.path,
      worktree: project.worktree,
      client: this.client,
      projectScope: project.name,  // for memory scoping
    };
  }
}

// New tools for workspace management
boomerang_workspace_create: tool({
  description: "Create a new multi-project workspace",
  args: { name: tool.schema.string(), rootPath: tool.schema.string() },
  async execute(args) { /* ... */ },
}),

boomerang_workspace_add_project: tool({
  description: "Add a project to the workspace",
  args: { workspace: tool.schema.string(), name: tool.schema.string(), path: tool.schema.string() },
  async execute(args) { /* ... */ },
}),
```

### Implementation Roadmap

#### Phase 1: Workspace Core (1-2 weeks)
- [ ] Implement `WorkspaceManager` with CRUD operations
- [ ] Implement `Project` model and `ProjectRegistry` (JSON persistence)
- [ ] Add workspace configuration schema
- [ ] Implement `boomerang workspace create/add-project/list` tools

#### Phase 2: Multi-Project Sessions (1-2 weeks)
- [ ] Extend `SessionState` to track per-project task states
- [ ] Implement `WorkspaceSession` with dirty-repo tracking
- [ ] Modify `OrchestratorContext` to include project scope
- [ ] Update session creation to support workspace mode

#### Phase 3: Cross-Project DAG (1 week)
- [ ] Extend `buildDAG()` with cross-project dependency detection
- [ ] Parse dependency graphs from package managers (npm, pip, cargo)
- [ ] Add topological sort that respects cross-project edges
- [ ] Handle circular dependency detection

#### Phase 4: Context Routing (1 week)
- [ ] Implement `ContextRouter` for per-project agent contexts
- [ ] Scope super-memory queries by project name
- [ ] Update git operations to target correct repo
- [ ] Update quality gates to run per-project

#### Phase 5: Sync & Automation (1-2 weeks)
- [ ] Implement `SyncManager` for cross-repo version bumps
- [ ] Auto-detect downstream projects that need updates
- [ ] Add workspace-wide git status and commit
- [ ] Implement workspace-level quality gates

### Estimated Complexity

**High**

- Touches nearly every core component
- Cross-project DAG adds significant scheduling complexity
- Git operations across multiple repos require careful orchestration
- Memory scoping changes the super-memory integration contract

### Dependencies

| Depends On | Reason |
|------------|--------|
| None directly | Can be implemented independently |
| Item 8 (LLM Providers) | Different projects may use different providers |
| Item 10 (Metrics) | Per-project metrics aggregation |
| Item 11 (Routing) | Per-project agent routing preferences |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Item 8: LLM Providers                                          │
│       │                                                         │
│       ├──► Item 10: Metrics (token usage, cost per provider)    │
│       │       │                                                 │
│       │       └──► Item 11: Routing (cost-aware, availability)  │
│       │                                                         │
│       └──► Item 11: Routing (more provider options)             │
│               │                                                 │
│               └──► Item 12: Workspace (per-project providers)   │
│                                                                 │
│  Item 9: Marketplace (independent)                              │
│       │                                                         │
│       └──► Item 12: Workspace (marketplace plugins per-project) │
│                                                                 │
│  Item 10: Metrics                                               │
│       │                                                         │
│       └──► Item 11: Routing (historical performance data)       │
│                                                                 │
│  Item 12: Workspace (can use all above)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Dependencies Table

| Item | Depends On | Dependency Type | Reason |
|------|------------|-----------------|--------|
| 8 | None | — | Foundation |
| 9 | None | — | Parallel concern |
| 10 | 8 | **Strong** | Need provider-specific token/cost APIs |
| 11 | 8 | **Strong** | Need provider cost and availability |
| 11 | 10 | **Strong** | Need historical performance data |
| 12 | 8 | **Weak** | Per-project provider configs (nice-to-have) |
| 12 | 10 | **Weak** | Per-project metrics (nice-to-have) |
| 12 | 11 | **Weak** | Per-project routing (nice-to-have) |
| 12 | 9 | **Weak** | Per-project plugins (nice-to-have) |

---

## Implementation Priority Matrix

| Priority | Item | Rationale | Estimated Effort | Risk |
|----------|------|-----------|------------------|------|
| **P0** | 8 — LLM Providers | Unlocks all other items; highest user demand | 4-5 weeks | Medium |
| **P1** | 10 — Metrics | Required for routing optimization; valuable standalone | 3-4 weeks | Low |
| **P2** | 11 — Routing | Major efficiency gain; depends on 8 + 10 | 3-4 weeks | High |
| **P3** | 12 — Workspace | High complexity; addresses power-user needs | 5-7 weeks | High |
| **P4** | 9 — Marketplace | Ecosystem growth; can be simplified (static registry) | 4-6 weeks | Medium |

### Recommended Implementation Order

```
Phase 1 (Months 1-2): Foundation
  ├─ Item 8: LLM Providers
  └─ Item 10: Metrics (partial — basic collection)

Phase 2 (Months 2-3): Intelligence
  ├─ Item 10: Metrics (complete — dashboard, alerts)
  └─ Item 11: Routing (depends on 8 + 10)

Phase 3 (Months 3-4): Scale
  ├─ Item 12: Workspace (depends on 8, 10, 11)
  └─ Item 9: Marketplace (can run in parallel)
```

### Suggested Sprint Breakdown

| Sprint | Focus | Deliverables |
|--------|-------|--------------|
| Sprint 1 | Provider Adapter Interface + Registry | `LLMProvider` interface, `ProviderRegistry`, 2 adapter implementations |
| Sprint 2 | Provider Adapters (completion) | All major providers, fallback chain, config validation |
| Sprint 3 | Metrics Collection | Event system, `MetricsCollector`, integration into executor/orchestrator |
| Sprint 4 | Metrics Storage + Dashboard | `JsonFileStore`, `AgentDashboard`, cost tracking |
| Sprint 5 | Intelligent Routing (core) | `PerformanceDB`, `FeatureExtractor`, `RouterModel` |
| Sprint 6 | Intelligent Routing (feedback) | `FeedbackLoop`, `RouteOptimizer`, exploration strategy |
| Sprint 7 | Workspace Core | `WorkspaceManager`, `ProjectRegistry`, multi-project sessions |
| Sprint 8 | Workspace Advanced | Cross-project DAG, `ContextRouter`, `SyncManager` |
| Sprint 9 | Marketplace MVP | `InstallManager`, `PluginManifest`, basic registry client |
| Sprint 10 | Marketplace Polish | Trust store, update checker, CLI tools |

---

## Appendix A: File Structure (Post-Implementation)

```
.opencode/plugins/boomerang/src/
├── index.ts                    # Plugin entry (extended with new tools)
├── types.ts                    # Extended with provider, metrics, workspace types
├── orchestrator.ts             # Minor changes for workspace/multi-provider
├── task-parser.ts              # Integrates RouterModel
├── task-executor.ts            # Uses ProviderRegistry instead of MODEL_ROUTING
├── session-state.ts            # Extended for workspace sessions
├── git.ts                      # Minor changes for multi-repo
├── quality-gates.ts            # Emits metrics events
├── memory.ts                   # Extended with project scoping
├── middleware.ts               # Unchanged
├── context-isolation.ts        # Unchanged
├── lazy-compaction.ts          # Unchanged
├── agent-state.ts              # Unchanged
├── task-state.ts               # Minor changes for project field
│
├── providers/                  # NEW: Item 8
│   ├── adapter.ts              # LLMProvider interface
│   ├── registry.ts             # ProviderRegistry singleton
│   ├── router.ts               # ModelRouter (replaces MODEL_ROUTING)
│   ├── fallback.ts             # FallbackChain logic
│   ├── config.ts               # ProviderConfig Zod schema
│   ├── openai.ts               # OpenAI-compatible adapter
│   ├── anthropic.ts            # Anthropic adapter
│   ├── google.ts               # Google Gemini adapter
│   ├── kimi.ts                 # Moonshot Kimi adapter
│   └── local.ts                # Ollama/local adapter
│
├── metrics/                    # NEW: Item 10
│   ├── collector.ts            # MetricsCollector event bus
│   ├── buffer.ts               # MetricsBuffer ring buffer
│   ├── store.ts                # MetricsStore interface
│   ├── cost.ts                 # CostTracker
│   ├── health.ts               # HealthMonitor
│   ├── dashboard.ts            # AgentDashboard CLI
│   ├── reporter.ts             # MetricsReporter
│   └── stores/
│       ├── json.ts             # JsonFileStore (default)
│       └── clickhouse.ts       # ClickHouseStore (optional)
│
├── routing/                    # NEW: Item 11
│   ├── router.ts               # RouterModel scoring engine
│   ├── features.ts             # FeatureExtractor
│   ├── performance.ts          # PerformanceDB
│   ├── optimizer.ts            # RouteOptimizer
│   ├── preferences.ts          # UserPreferenceTracker
│   ├── explore.ts              # ExplorationStrategy
│   └── config.ts               # RoutingConfig
│
├── workspace/                  # NEW: Item 12
│   ├── manager.ts              # WorkspaceManager
│   ├── project.ts              # Project model
│   ├── registry.ts             # ProjectRegistry
│   ├── dag.ts                  # CrossProjectDAG builder
│   ├── router.ts               # ContextRouter
│   ├── session.ts              # WorkspaceSession
│   ├── sync.ts                 # SyncManager
│   └── config.ts               # WorkspaceConfig schema
│
└── marketplace/                # NEW: Item 9
    ├── client.ts               # MarketplaceClient
    ├── manifest.ts             # PluginManifest schema
    ├── installer.ts            # InstallManager
    ├── deps.ts                 # DependencyResolver
    ├── trust.ts                # TrustStore
    ├── update.ts               # UpdateChecker
    ├── registry.ts             # RegistryAPI interface
    └── cli.ts                  # PluginCLI commands
```

---

## Appendix B: Configuration Schema (Future opencode.json)

```json
{
  "plugin": ["opencode-boomerang"],
  "boomerang": {
    "workspace": {
      "name": "my-microservices",
      "projects": [
        { "name": "frontend", "path": "./web-app", "dependencies": ["shared"] },
        { "name": "backend", "path": "./api-srv", "dependencies": ["shared"] },
        { "name": "shared", "path": "./lib-core", "dependencies": [] }
      ]
    },
    "providers": {
      "openai": {
        "apiKey": "${OPENAI_API_KEY}",
        "models": { "gpt-5": "gpt-5.4" }
      },
      "anthropic": {
        "apiKey": "${ANTHROPIC_API_KEY}",
        "models": { "claude": "claude-sonnet-4" }
      },
      "local": {
        "baseUrl": "http://localhost:11434",
        "models": { "llama": "llama3.3:70b" }
      }
    },
    "routing": {
      "strategy": "balanced",
      "explorationRate": 0.1,
      "weights": {
        "success": 0.4,
        "latency": 0.2,
        "cost": 0.15,
        "affinity": 0.15,
        "preference": 0.1
      }
    },
    "metrics": {
      "enabled": true,
      "store": "json",
      "retentionDays": 30,
      "alertThresholds": {
        "minSuccessRate": 0.8,
        "maxLatencyMs": 30000,
        "maxDailyCost": 10.0
      }
    },
    "marketplace": {
      "registryUrl": "https://boomerang.dev/registry",
      "trustedAuthors": ["boomerang-team", "verified"]
    }
  }
}
```

---

*End of Document*
