# Boomerang Handoff

## Last Session

- **Date**: [Not yet initialized]
- **Status**: Ready for first session

## Current State

This project is the Boomerang multi-agent orchestration system for OpenCode.

### What's Configured
- Core skills: orchestrator, coder, tester, architect, init, writer, scraper, handoff
- Session start protocol: auto-reads AGENTS.md, TASKS.md, HANDOFF.md, README.md
- Context compaction strategy: triggers at ~40% usage
- Super-memory integration: required for all agents

### What's Pending
- Create missing agent skills (explorer, linter, git)
- Full integration testing
- NPM publishing

## Resume Instructions

1. Read this HANDOFF.md file
2. Read AGENTS.md for agent roster
3. Read TASKS.md for current priorities
4. Query super-memory for detailed context
5. Proceed with highest priority task

## Notes

- boomerang-init has hard rules: only append to default personas, never replace core prompts
- Sequential thinking is mandatory for orchestrator on complex tasks
- All agents must use super-memory