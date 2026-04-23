# LLM Provider Guide for Boomerang

> **Document Version**: 1.0.0  
> **Last Updated**: 2026-04-23  
> **Status**: v1.0.0 Feature Documentation  
> **Scope**: LLM provider configuration and agent model assignments

---

## Table of Contents

1. [Overview](#overview)
2. [Provider Comparison](#provider-comparison)
3. [Agent Model Assignments](#agent-model-assignments)
4. [Configuration](#configuration)
5. [Local Model Setup](#local-model-setup)
6. [Provider-Specific Notes](#provider-specific-notes)

---

## Overview

Boomerang v1.0.0 supports multiple LLM providers. Currently, two providers are configured as primary:

| Provider | API | Primary Use |
|----------|-----|-------------|
| **Kimi (Moonshot)** | Kimi K2.6 | Reasoning agents (orchestrator, architect, writer) |
| **MiniMax** | MiniMax M2.7 | Fast execution agents (coder, explorer, tester) |

---

## Provider Comparison

### Cloud Providers

| Provider | Model | Context | Strengths | Weaknesses |
|----------|-------|---------|-----------|------------|
| **Kimi** | K2.6 | 128K | Excellent reasoning, Chinese language | Limited English optimization |
| **MiniMax** | M2.7 | 128K | Fast generation, cost-effective | Less reasoning depth |
| **OpenAI** | GPT-4o | 128K | Best all-around reasoning | Higher cost |
| **Anthropic** | Claude 3.5 | 200K | Long context, safety | Higher cost |
| **Google** | Gemini 2.0 | 1M | Massive context, multimodal | Variable quality |

### Cost Comparison (per 1M tokens)

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| Kimi | K2.6 | ~$0.5 | ~$1.5 |
| MiniMax | M2.7 | ~$0.2 | ~$0.5 |
| OpenAI | GPT-4o | ~$5 | ~$15 |
| Anthropic | Claude 3.5 | ~$3 | ~$15 |
| Google | Gemini 2.0 | ~$0.25 | ~$1 |

### Local Providers

| Provider | Model | VRAM | Context | Best For |
|----------|-------|------|---------|----------|
| **Ollama** | Llama 3.1 | 8GB+ | 8K-128K | Self-hosted, privacy |
| **LM Studio** | Various | 6GB+ | 4K-128K | Desktop, no cloud |
| **llama.cpp** | Various | 4GB+ | 4K-32K | Embedded, low resource |

---

## Agent Model Assignments

### Current Assignments (v1.0.0)

| Agent | Primary Model | Provider | Rationale |
|-------|--------------|----------|-----------|
| **boomerang** (Orchestrator) | Kimi K2.6 | Kimi/Moonshot | Complex planning, reasoning |
| **boomerang-architect** | Kimi K2.6 | Kimi/Moonshot | Design decisions, trade-offs |
| **boomerang-writer** | Kimi K2.6 | Kimi/Moonshot | Documentation writing |
| **boomerang-init** | Kimi K2.6 | Kimi/Moonshot | Session initialization |
| **boomerang-handoff** | Kimi K2.6 | Kimi/Moonshot | Context preservation |
| **boomerang-coder** | MiniMax M2.7 | MiniMax | Fast code generation |
| **boomerang-explorer** | MiniMax M2.7 | MiniMax | Quick file search |
| **boomerang-tester** | MiniMax M2.7 | MiniMax | Test writing speed |
| **boomerang-linter** | MiniMax M2.7 | MiniMax | Fast style checking |
| **boomerang-git** | MiniMax M2.7 | MiniMax | Quick git operations |
| **boomerang-scraper** | MiniMax M2.7 | MiniMax | Web research speed |

### Model Selection Criteria

| Task Type | Recommended Agent | Model Choice |
|-----------|-------------------|--------------|
| Complex architecture | boomerang-architect | Kimi K2.6 (reasoning) |
| Rapid prototyping | boomerang-coder | MiniMax M2.7 (speed) |
| Long documentation | boomerang-writer | Kimi K2.6 (context) |
| Bug investigation | boomerang-explorer | MiniMax M2.7 (speed) |
| Test writing | boomerang-tester | MiniMax M2.7 (speed) |
| Code review | boomerang-architect | Kimi K2.6 (reasoning) |

---

## Configuration

### Primary Config (opencode.json)

```json
{
  "boomerang": {
    "providers": {
      "kimi": {
        "name": "Kimi (Moonshot)",
        "api_key_env": "MOONSHOT_API_KEY",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "moonshot-v1-128k",
        "vision_enabled": false
      },
      "minimax": {
        "name": "MiniMax",
        "api_key_env": "MINIMAX_API_KEY",
        "base_url": "https://api.minimax.chat/v1",
        "model": "MiniMax-Text-01",
        "vision_enabled": false
      }
    },
    "agents": {
      "orchestrator": "kimi",
      "architect": "kimi",
      "writer": "kimi",
      "init": "kimi",
      "handoff": "kimi",
      "coder": "minimax",
      "explorer": "minimax",
      "tester": "minimax",
      "linter": "minimax",
      "git": "minimax",
      "scraper": "minimax"
    }
  }
}
```

### Environment Variables

```bash
# Kimi (Moonshot)
export MOONSHOT_API_KEY="your-kimi-api-key"

# MiniMax
export MINIMAX_API_KEY="your-minimax-api-key"

# Optional: Override default provider
export BOOMERANG_DEFAULT_PROVIDER="kimi"
```

### Global OpenCode Config

In `~/.opencode/opencode.json`:

```json
{
  "providers": {
    "kimi": {
      "api_key": "env:MOONSHOT_API_KEY",
      "model": "moonshot-v1-128k"
    },
    "minimax": {
      "api_key": "env:MINIMAX_API_KEY",
      "model": "MiniMax-Text-01"
    }
  }
}
```

---

## Local Model Setup

### Ollama Configuration

For local models via Ollama:

```json
{
  "boomerang": {
    "providers": {
      "ollama": {
        "name": "Ollama (Local)",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3.1:8b",
        "api_key": "ollama"
      }
    },
    "agents": {
      "coder": "ollama",
      "explorer": "ollama"
    }
  }
}
```

### Running Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Run server (auto-starts)
ollama serve

# Test
curl http://localhost:11434/api/generate -d '{"model":"llama3.1:8b","prompt":"Hello"}'
```

### LM Studio Configuration

```json
{
  "boomerang": {
    "providers": {
      "lmstudio": {
        "name": "LM Studio (Local)",
        "base_url": "http://localhost:1234/v1",
        "model": "your-model-name",
        "api_key": "lm-studio"
      }
    }
  }
}
```

---

## Provider-Specific Notes

### Kimi (Moonshot)

**Strengths:**
- Excellent for Chinese language tasks
- Strong reasoning for planning/architecture
- 128K context window

**Configuration:**
```bash
export MOONSHOT_API_KEY="mo_..."
# API endpoint: https://api.moonshot.cn/v1
```

**Rate Limits:**
- Default: 60 requests/minute
- Contact Moonshot for higher limits

### MiniMax

**Strengths:**
- Very fast generation
- Cost-effective for high-volume tasks
- Good for code generation

**Configuration:**
```bash
export MINIMAX_API_KEY="eyJ..."
# API endpoint: https://api.minimax.chat/v1
```

**Rate Limits:**
- Default: 100 requests/minute
- Batch processing available

### OpenAI (Planned)

**Coming Soon:**
- GPT-4o integration
- GPT-4 Turbo integration
- Vision support

### Anthropic (Planned)

**Coming Soon:**
- Claude 3.5 Sonnet
- 200K context support
- Vision support

---

## Fallback Behavior

If primary provider fails, Boomerang falls back:

| Agent | Primary | Fallback |
|-------|---------|----------|
| orchestrator | Kimi K2.6 | MiniMax M2.7 |
| architect | Kimi K2.6 | MiniMax M2.7 |
| coder | MiniMax M2.7 | Kimi K2.6 |
| explorer | MiniMax M2.7 | Kimi K2.6 |

Fallback chain is configurable:

```json
{
  "boomerang": {
    "agents": {
      "orchestrator": {
        "primary": "kimi",
        "fallback": ["minimax", "ollama"]
      }
    }
  }
}
```

---

## Related Documents

- [AGENTS.md](../AGENTS.md) — Full agent roster
- [METRICS.md](./METRICS.md) — Performance tracking
- [super-memory-best-practices.md](./super-memory-best-practices.md) — Memory protocol