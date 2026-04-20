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
- [x] Create missing agent skills (boomerang-explorer, boomerang-linter, boomerang-git)
- [x] Research LangChain deepagents for competitive insights
- [ ] Implement context isolation for subagents (learned from deepagents)
- [ ] Create/update AGENTS.md with full agent roster
- [ ] Create HANDOFF.md template
- [ ] Update README.md with new skills and agents

### Medium Priority

- [ ] Implement context compaction agent/skill
- [ ] Add tool result eviction / large output offloading
- [ ] Implement middleware hooks (wrap_model_call, wrap_tool_call)
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

## Notes

- Context compaction should trigger at ~40% context usage
- Handoff skill should be called before compaction to preserve state
- All agents must query super-memory at start and save at end
- Sequential thinking is mandatory for complex tasks
- boomerang-init must only append to default personas, never replace core prompts
