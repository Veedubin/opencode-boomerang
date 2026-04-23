# Boomerang Metrics Guide

> **Document Version**: 1.0.0  
> **Last Updated**: 2026-04-23  
> **Status**: v1.0.0 Feature Documentation  
> **Scope**: Agent performance tracking and routing optimization

---

## Table of Contents

1. [Overview](#overview)
2. [Metrics Collected](#metrics-collected)
3. [How Metrics Collection Works](#how-metrics-collection-works)
4. [Routing Optimizer](#routing-optimizer)
5. [Viewing Metrics](#viewing-metrics)
6. [Configuration](#configuration)

---

## Overview

Boomerang v1.0.0 includes a comprehensive metrics collection system that tracks agent performance and enables automatic routing optimization. This helps the orchestrator make intelligent decisions about which agent to use for specific tasks based on historical performance data.

### Why Metrics Matter

Without metrics, the orchestrator uses static rules to route tasks. With metrics, Boomerang can:
- Identify which agents perform best on specific task types
- Detect performance regressions before they impact productivity
- Balance workload based on agent efficiency
- Optimize cost by selecting the right model for each task

---

## Metrics Collected

### Agent Performance Metrics

| Metric | Description | Data Type |
|--------|-------------|-----------|
| `task_type` | Category of task executed | string |
| `agent_id` | Which agent handled the task | string |
| `duration_ms` | Task execution time in milliseconds | integer |
| `success` | Whether task completed successfully | boolean |
| `error_message` | Error details if failed | string (optional) |
| `tokens_used` | LLM token consumption | integer |
| `context_used_pct` | Percentage of context window used | float |
| `timestamp` | When task was executed | ISO8601 |

### Task Type Categories

Boomerang categorizes tasks to enable pattern analysis:

| Category | Description | Examples |
|----------|-------------|----------|
| `code_generation` | Writing new code or modifying existing | Create function, refactor, implement feature |
| `code_review` | Reviewing code for issues | PR review, code analysis |
| `testing` | Writing or running tests | Unit tests, integration tests |
| `debugging` | Finding and fixing bugs | Error investigation, fix implementation |
| `exploration` | Understanding codebase | Finding files, understanding structure |
| `documentation` | Writing docs | README, API docs, code comments |
| `git_operations` | Version control tasks | commits, branches, merges |
| `research` | Web or code research | Searching, fetching information |
| `refactoring` | Improving code structure | Pattern application, cleanup |

### Aggregated Metrics

For routing decisions, Boomerang tracks:

| Metric | Description |
|--------|-------------|
| `avg_duration` | Average task duration per agent per task type |
| `success_rate` | Percentage of successful tasks |
| `avg_tokens` | Average token usage per task type |
| `total_tasks` | Count of tasks processed |

---

## How Metrics Collection Works

### Automatic Collection

The Boomerang orchestrator automatically collects metrics during task execution:

```
Task Received
    │
    ▼
┌─────────────────┐
│ Execute via     │
│ assigned agent  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Capture metrics │
│ - start_time    │
│ - end_time      │
│ - success/fail  │
│ - token count   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store in        │
│ metrics store   │
└─────────────────┘
```

### Metrics Storage

Metrics are stored in `memory_data/metrics/` directory:

```
memory_data/
└── metrics/
    └── agent_metrics.lance  # LanceDB table for fast queries
```

### Data Flow

1. **Task Assignment**: Orchestrator assigns task to agent
2. **Execution Monitoring**: Hooks wrap agent calls to capture timing and outcomes
3. **Metrics Storage**: Data stored in local LanceDB for fast retrieval
4. **Aggregation**: Periodic aggregation for routing decisions

---

## Routing Optimizer

The routing optimizer uses collected metrics to improve task assignment decisions.

### How It Works

1. **Historical Analysis**: Examine past performance for similar tasks
2. **Agent Selection**: Choose agent with best success rate for task type
3. **Fallback Strategy**: If no historical data, use static rules
4. **Continuous Learning**: Update routing based on new metrics

### Decision Matrix

| Task Type | Primary Agent | Fallback | Rationale |
|-----------|---------------|----------|-----------|
| code_generation | boomerang-coder | boomerang-explorer | Speed-focused model for rapid implementation |
| code_review | boomerang-architect | boomerang-coder | Kimi K2.6 for reasoning-heavy review |
| testing | boomerang-tester | boomerang-coder | Test specialist with execution agent backup |
| debugging | boomerang-coder | boomerang-explorer | Fast code comprehension |
| exploration | boomerang-explorer | boomerang-coder | Code exploration is primary skill |
| documentation | boomerang-writer | boomerang-coder | Documentation specialist |
| git_operations | boomerang-git | boomerang-coder | Git specialist |
| research | boomerang-scraper | boomerang | Web scraping expertise |
| refactoring | boomerang-architect | boomerang-coder | Architecture review before changes |

### Override Mechanism

Users can override automatic routing by explicitly specifying agents in task descriptions.

---

## Viewing Metrics

### Metrics Dashboard

Boomerang provides a built-in metrics view via the orchestrator:

```
/boomerang-metrics
```

This shows:
- Recent task performance
- Agent success rates
- Average task durations
- Context usage trends

### Query Metrics Directly

For programmatic access:

```javascript
// Query metrics for specific agent
const agentMetrics = await query_memory({
  question: "Show me boomerang-coder performance for code_generation tasks",
  top_k: 10
});
```

### Export Metrics

Export metrics for external analysis:

```bash
# Export to CSV
boomerang-export-metrics --format csv --output metrics.csv

# Export to JSON
boomerang-export-metrics --format json --output metrics.json
```

---

## Configuration

### Enable/Disable Metrics

Metrics collection is enabled by default. To disable:

```json
{
  "boomerang": {
    "metrics": {
      "enabled": false
    }
  }
}
```

### Metrics Retention

Configure how long metrics are kept:

```json
{
  "boomerang": {
    "metrics": {
      "retention_days": 30
    }
  }
}
```

### Routing Optimization

Configure routing behavior:

```json
{
  "boomerang": {
    "routing": {
      "use_metrics": true,
      "min_samples": 5,
      "explore_probability": 0.1
    }
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `use_metrics` | true | Use metrics for routing decisions |
| `min_samples` | 5 | Minimum historical samples before trusting metrics |
| `explore_probability` | 0.1 | Probability of trying non-optimal route for learning |

---

## Related Documents

- [AGENTS.md](../AGENTS.md) — Agent roster and model assignments
- [WORKSPACES.md](./WORKSPACES.md) — Multi-project workspace management
- [super-memory-best-practices.md](./super-memory-best-practices.md) — Memory protocol guide