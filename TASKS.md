# Boomerang Tasks

## Current Sprint

### High Priority

- [x] Update boomerang-orchestrator skill to allow markdown reads for context
- [x] Update boomerang-orchestrator skill to enforce sequential thinking
- [x] Update boomerang-orchestrator skill with session start protocol (auto-read AGENTS.md, TASKS.md, HANDOFF.md, README.md)
- [x] Update boomerang-orchestrator skill with context compaction strategy
- [x] Update boomerang-init skill with hard rules (protect core prompting, append-only customizations)
- [x] Create boomerang-handoff skill for session wrap-up
- [x] Create boomerang-writer skill for documentation
- [x] Create boomerang-scraper skill for web research
- [x] Update all agent skills with super-memory protocol requirements
- [x] Create missing agent skills (explorer, linter, git)
- [x] Research LangChain deepagents for competitive insights
- [x] Implement context isolation for subagents
- [x] Add tool result eviction / large output offloading
- [x] Implement middleware hooks concept (wrap_model_call, wrap_tool_call)
- [x] Create/update AGENTS.md with full agent roster
- [x] Create HANDOFF.md template
- [x] Update README.md with new skills and agents
- [x] Test Boomerang on sports-bet project
- [x] Package and publish v0.2.0

### Medium Priority

- [ ] Implement context compaction agent/skill
- [ ] Add web scraping integration tests
- [ ] Create example project initialization flow
- [ ] Document super-memory best practices

### Low Priority

- [ ] Add NPM publishing documentation
- [ ] Create video/tutorial for setup
- [ ] Review deepagents SKILL.md pattern for inspiration

## Backlog

- [ ] Support for additional LLM providers
- [ ] Plugin marketplace integration
- [ ] Agent performance metrics
- [ ] Automatic agent routing optimization
- [ ] Multi-project workspace support

## Completed

- [x] Initial skill creation (orchestrator, coder, tester, architect, init)
- [x] README.md with installation and configuration
- [x] Super-memory integration documentation
- [x] Basic agent roster definition
- [x] Rebuilt TypeScript plugin runtime from compiled JS to proper TS source
- [x] Added test infrastructure with 29 passing tests
- [x] Updated sports-bet project with latest Boomerang setup

## Notes

- Context compaction should trigger at ~40% context usage
- Handoff skill should be called before compaction to preserve state
- All agents must query super-memory at start and save at end
- Sequential thinking is mandatory for complex tasks
- boomerang-init must only append to default personas, never replace core prompts