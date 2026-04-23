# Boomerang Roadmap

## Vision/Mission

Boomerang is a multi-agent orchestration system for OpenCode that enables intelligent, context-aware task delegation across specialized AI agents. The system provides a scalable framework for building complex AI-driven development workflows with built-in memory persistence, context management, and seamless agent collaboration.

**Mission**: Empower developers to create sophisticated AI orchestration workflows through a modular, extensible agent system that maintains context across sessions and scales from simple tasks to complex multi-agent collaborations.

---

## Phase 1: Core Multi-Agent System (Completed)

### Goals
- Establish fundamental agent roles and communication patterns
- Create base skill infrastructure
- Implement super-memory integration for context persistence

### Deliverables
- [x] Initial skill creation (orchestrator, coder, tester, architect, init)
- [x] README.md with installation and configuration
- [x] Super-memory integration documentation
- [x] Basic agent roster definition
- [x] AGENTS.md with full agent roster
- [x] HANDOFF.md template for session transitions

### Agents Created
- boomerang-orchestrator (Kimi K2.5)
- boomerang-coder (MiniMax M2.7)
- boomerang-tester (Gemini 3 Pro)
- boomerang-architect (Kimi K2.5)
- boomerang-init (Kimi K2.5)

---

## Phase 2: TypeScript Runtime & Deep Agents Features (Completed)

### Goals
- Rebuild plugin runtime in TypeScript for better type safety
- Add advanced orchestration capabilities
- Enable context isolation and result offloading

### Deliverables
- [x] Rebuilt TypeScript plugin runtime from compiled JS
- [x] Added test infrastructure with 29 passing tests
- [x] Context isolation for subagents
- [x] Tool result eviction / large output offloading
- [x] Updated sports-bet project with latest Boomerang setup

### Advanced Features
- [x] Middleware hooks concept (wrap_model_call, wrap_tool_call)
- [x] Sequential thinking enforcement for complex tasks
- [x] Session start protocol (auto-read context files)
- [x] Deep research on LangChain deepagents for competitive insights

---

## Phase 3: Context Compaction, Documentation & Testing (Completed)

### Goals
- Implement context compaction to handle long-running sessions
- Complete documentation for all skills and agents
- Add integration tests for web research workflows
- Fix super-memory protocol to be mandatory

### Deliverables
- [x] Implement context compaction via handoff skill (trigger at ~40% context usage)
- [x] Add web scraping integration tests (29 tests, 58 total passing)
- [x] Create example project initialization flow
- [x] Document super-memory best practices and tiered architecture
- [x] Make super-memory protocol MANDATORY for all 11 sub-agents
- [x] Upgrade all models to Kimi K2.6 / MiniMax M2.7
- [x] Add per-project DB isolation (memory_data/ directories)
- [x] Add tiered memory search (Fast Reply + Archivist modes)
- [x] Fix hanging issues (steps:50 limit, anti-loop safety)

### Context Compaction Strategy
- Trigger at ~40% context usage
- Preserve critical decisions and current state
- Summarize completed work for future recall
- Handoff skill called before compaction to preserve state

### Documentation Updates
- [x] boomerang-orchestrator skill updated with markdown reads and sequential thinking
- [x] boomerang-init skill with hard rules (protect core prompting, append-only)
- [x] boomerang-handoff skill for session wrap-up
- [x] boomerang-writer skill for documentation
- [x] boomerang-scraper skill for web research
- [x] All agent skills with super-memory protocol requirements
- [x] Create/update AGENTS.md with full agent roster
- [x] Update README.md with new skills and agents

---

## Phase 4: Built-in Memory Integration, Middleware & Metrics (Completed ✅ v1.0.0)

### Goals
- Implement built-in Super-Memory integration (no MCP overhead)
- Add automatic project indexing on startup
- Implement production-ready middleware hooks
- Enable automatic agent routing optimization

### Deliverables

| Feature | Status | Notes |
|---------|--------|-------|
| Built-in Super-Memory | ✅ Complete | Direct import of Super-Memory-TS core modules |
| Automatic Project Indexing | ✅ Complete | chokidar with semantic chunking |
| Background File Watching | ✅ Complete | Incremental SHA-256 updates |
| Agent Performance Metrics | ✅ Complete | Collection system implemented |
| Routing Optimizer | ✅ Complete | Metrics-based optimization |
| Production Middleware Hooks | ✅ Complete | wrap_model_call, wrap_tool_call |

### Built-in Memory Architecture

Boomerang now includes direct Super-Memory integration:

| Integration Mode | Description |
|------------------|-------------|
| **Built-in (Default)** | Direct import of Super-Memory-TS core modules. No MCP server needed. Indexes project on startup automatically. |
| **MCP (Legacy)** | External MCP server for cross-session persistence. Used only when MCP mode is explicitly configured. |

#### Features
- **Automatic Startup Indexing**: When the Boomerang plugin loads, it automatically indexes the current project
- **Background File Watching**: Chokidar watches for changes and incrementally updates the index
- **No MCP Overhead**: Direct module calls eliminate HTTP latency and protocol overhead
- **Per-Project DB Isolation**: Each project gets its own `memory_data/` directory

### Technical Considerations
- Super-Memory-TS core modules imported directly by Boomerang
- File watcher runs continuously in background
- MCP mode still available for external users who want standalone server

---

## Phase 5: Multi-Project Workspaces, Plugin Marketplace & LLM Providers (Completed ✅ v1.0.0)

### Goals
- Support multi-project workspace workflows
- Create plugin marketplace for community contributions
- Add additional LLM provider support

### Deliverables

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-project workspace support | ✅ Complete (v1.0.0) | Switch between projects with isolated memory |
| Plugin marketplace integration | 🔜 Future | Community plugin submissions |
| OpenAI provider | 🔜 Future | GPT-4o, GPT-4 Mini integration |
| Anthropic Claude provider | 🔜 Future | Claude 3.5 Sonnet integration |
| Google Gemini provider | 🔜 Future | Gemini 1.5/2.0 integration |
| Local model support | 🔜 Future | Ollama, LM Studio integration |

### LLM Provider Considerations

| Provider | Models | Status |
|----------|--------|--------|
| Kimi (Moonshot) | Kimi K2.6 | ✅ Primary - used for orchestrator, architect, writer, init, handoff |
| MiniMax | MiniMax M2.7 | ✅ Primary - used for coder, explorer, tester, linter, git, scraper |
| OpenAI | GPT-4o, GPT-4 Mini | 🔜 Planned |
| Anthropic | Claude 3.5 Sonnet | 🔜 Planned |
| Google | Gemini 1.5/2.0 | 🔜 Planned |
| Ollama | Local models | 🔜 Planned |

---

## Strategic Principles

1. **Context Preservation**: All agents must query super-memory at start and save at end
2. **Append-Only Customization**: boomerang-init must only append to default personas, never replace core prompts
3. **Sequential Thinking**: Mandatory for complex tasks to ensure thorough reasoning
4. **Session Handoff**: Critical state must be preserved before context compaction triggers

---

## Appendix: Completed Milestones

- Initial skill creation (orchestrator, coder, tester, architect, init)
- README.md with installation and configuration
- Super-memory integration documentation
- Basic agent roster definition
- Rebuilt TypeScript plugin runtime
- Added test infrastructure (29 passing tests)
- Updated sports-bet project with latest Boomerang setup
- Package and publish v0.3.0