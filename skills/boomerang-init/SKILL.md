---
name: boomerang-init
description: Initialize and personalize Boomerang agents for your project. Run once at project start, and again anytime you want to refresh agents as the project evolves.
---

# Boomerang Init

## Description

Initialize Boomerang agents by downloading canonical agent definitions from GitHub.

## Context Requirements (from Orchestrator)

You MUST receive:
1. **Project Path** — Where to initialize
2. **Project Type** — (or ask user if not provided)
3. **Customization Scope** — What to customize vs leave default

## Init Conventions (MANDATORY)

- **PROTECTED elements must never be modified** — Core protocol steps, agent roster structure
- **Append-only customizations** — Add to existing, don't replace
- **Never remove core agents** — All 11 agents must remain
- **Preserve skill structure** — Skill files follow standard format
- **Document changes** — Update AGENTS.md with any customizations
- **Test installation** — Run install script after changes to verify

## Usage

Run the install script:

```bash
npx @veedubin/boomerang-v2 install-agents
```

Or if you have the package installed:

```bash
boomerang-install
```

This will:
1. Create `.opencode/agents/` directory in your current directory
2. Download all boomerang agents from GitHub
3. Create `.opencode/opencode.json` with default plugin config

## Agents Downloaded

- boomerang.md
- boomerang-architect.md
- boomerang-coder.md
- boomerang-explorer.md
- boomerang-git.md
- boomerang-handoff.md
- boomerang-init.md
- boomerang-linter.md
- boomerang-scraper.md
- boomerang-tester.md
- boomerang-writer.md
- researcher.md

## File Locations

Agents are downloaded from:
```
https://raw.githubusercontent.com/Veedubin/opencode-boomerang/main/agents/{name}.md
```

Installed to: `.opencode/agents/`

## Output Format (Return to Orchestrator)

```markdown
## Boomerang Init Complete

### Project Type: [Type]
### Agents Customized: [list]
### New Agents Created: [list]
### Files Modified: [list]

### Memory Reference
Init details saved. Query: "[descriptive query]"
```