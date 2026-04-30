# DeepAgents SKILL.md Pattern Review

> **Reviewed**: 2026-04-20  
> **Source**: [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) + [Agent Skills Specification](https://agentskills.io/specification)  
> **Purpose**: Task 7 from TASKS.md — Extract patterns for Boomerang skill system improvement

---

## Summary

DeepAgents implements a formal **Agent Skills** specification that is well-documented, production-tested, and backed by an open spec at `agentskills.io`. Boomerang's skill system is conceptually similar but lacks formal structure, progressive disclosure, and tooling. Several patterns are directly adoptable.

---

## 1. Agent Skills Specification (agentskills.io)

### Key Formalisms

| Field | Purpose | Boomerang Status |
|-------|---------|------------------|
| `name` | Skill identifier (max 64 chars, lowercase-hyphen only) | ✅ Present but informal |
| `description` | Trigger guidance (max 1024 chars) | ✅ Present but no character limit |
| `license` | Licensing info | ❌ Missing |
| `compatibility` | Environment requirements (network, packages, etc.) | ❌ Missing |
| `metadata` | Arbitrary key-value (author, version) | ❌ Missing |
| `allowed-tools` | Pre-approved tool whitelist (experimental) | ❌ Missing |

### Directory Structure Convention

```
skill-name/
├── SKILL.md          # Required: frontmatter + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: detailed docs (REFERENCE.md, FORMS.md)
├── assets/           # Optional: templates, images, data files
```

**Boomerang currently**: All skill content lives in a single `SKILL.md` file per skill directory. No `scripts/`, `references/`, or `assets/` subdirectories.

### Progressive Disclosure Model

DeepAgents enforces a 3-tier loading strategy:

1. **Metadata tier** (~100 tokens): `name` + `description` loaded at startup for all skills — used for skill matching
2. **Instructions tier** (<5000 tokens recommended): Full `SKILL.md` body loaded only when skill is activated
3. **Resources tier**: Files in `scripts/`, `references/`, `assets/` loaded on-demand

**Boomerang currently**: No progressive disclosure. Full `SKILL.md` is always in context regardless of relevance.

### Skill Matching

Agents check skill `description` at runtime to decide whether to activate a skill. Descriptions should include trigger keywords. This is called **skill discovery by progressive disclosure**.

**Boomerang currently**: Skills are loaded by explicit invocation, not discovered dynamically.

---

## 2. DeepAgents SKILL.md Format

### Example (langgraph-docs skill)

```md
---
name: langgraph-docs
description: Use this skill for requests related to LangGraph in order to fetch
  relevant documentation to provide accurate, up-to-date guidance.
license: MIT
compatibility: Requires internet access for fetching documentation URLs
metadata:
  author: langchain
  version: "1.0"
allowed-tools: fetch_url
---

# langgraph-docs

## Overview

This skill explains how to access LangGraph Python documentation...

## Instructions

### 1. Fetch the Documentation Index
...

### 2. Select Relevant Documentation
...
```

### Boomerang SKILL.md (current orchestrator)

```md
---
name: boomerang-orchestrator
description: Main coordinator for the Boomerang Protocol...
---

# Boomerang Orchestrator

## ⚠️ SESSION START PROTOCOL (MANDATORY - DO THIS FIRST)
...
```

**Gap**: Boomerang SKILL.md files lack `license`, `compatibility`, `metadata`, and `allowed-tools` fields. The body content has no enforced structure (e.g., `## Overview`, `## Instructions`, `### Step N`).

---

## 3. Core Patterns to Adopt

### 3.1 Formal Frontmatter Fields

**Recommendation**: Add the following optional fields to Boomerang SKILL.md frontmatter:

- `license` — Explicit licensing
- `compatibility` — "Requires network access", "Linux only", etc.
- `metadata` — `{ author, version }` map
- `allowed-tools` — Pre-approved tool list for skill isolation

### 3.2 Structured Body Sections

**Recommendation**: Enforce a conventional section structure in SKILL.md body:

```
## Overview        (1-3 sentences: what this skill does)
## Instructions    (step-by-step workflow)
## Examples        (input/output examples)
## Edge Cases      (common pitfalls, error handling)
```

This improves readability and makes skills more predictable.

### 3.3 scripts/ and references/ Subdirectories

**Recommendation**: Support skill subdirectories for:

- `scripts/` — Executable helper scripts (bash, python) the agent can invoke
- `references/` — Detailed reference docs (`REFERENCE.md`, `FORMS.md`) loaded on-demand

This enables progressive disclosure: a 50-line `SKILL.md` with pointers to `references/DETAILED.md` instead of dumping all content.

### 3.4 Skill Validation Tooling

DeepAgents references a validation CLI: `skills-ref validate ./my-skill`

**Recommendation**: Add a `boomerang-linter` skill check that validates:
- `name` matches directory name
- `description` ≤ 1024 characters
- Required frontmatter present
- Body follows conventional sections

### 3.5 Skills vs Memory Distinction

DeepAgents explicitly defines the difference:

| | Skills | Memory (AGENTS.md) |
|--|--------|-------------------|
| **Purpose** | On-demand, task-specific | Persistent, always-relevant |
| **Loading** | Progressive (matched then loaded) | Always injected |
| **Format** | `SKILL.md` in named directories | `AGENTS.md` files |
| **Layering** | User → project (last wins) | User → project (combined) |

**Boomerang currently**: Has both but the distinction is not formally documented. The AGENTS.md vs SKILL.md role is implicit.

### 3.6 Skill Source Precedence

DeepAgents: `skills=["/skills/user/", "/skills/project/"]` — later sources override earlier (last wins).

**Boomerang**: No documented layering system for skills.

### 3.7 Subagent Skill Isolation

DeepAgents: Subagents have isolated skill state — main agent's skills are not visible to subagents unless explicitly inherited.

**Boomerang**: The orchestrator delegates to sub-agents but skill inheritance is not formally defined.

### 3.8 Tool Allowlisting (experimental)

`allowed-tools: fetch_url` — skills can declare which tools they are pre-approved to use. This enables:
- Sandboxing untrusted skills
- Cost control
- Security boundaries

**Boomerang**: No equivalent.

---

## 4. Comparison: DeepAgents SDK vs Boomerang Architecture

| Feature | DeepAgents | Boomerang |
|---------|-----------|-----------|
| Skill discovery | Dynamic (description matching) | Explicit invocation |
| Progressive disclosure | 3-tier (metadata → instructions → resources) | None |
| Skill format | Formal spec (agentskills.io) | Informal markdown |
| Skill validation | `skills-ref validate` CLI | None |
| Skill layering | Last-wins precedence | Not defined |
| Subagent skills | Isolated + inheritable | Delegation-based |
| Allowed-tools | Supported (experimental) | Not supported |
| License/compatibility | In frontmatter | Not in frontmatter |
| Reference files | `references/`, `scripts/`, `assets/` | Not supported |

---

## 5. Actionable Recommendations

### High Priority

1. **Adopt formal frontmatter** — Add `license`, `compatibility`, `metadata`, and `allowed-tools` fields to SKILL.md frontmatter. Update `boomerang-linter` to validate them.

2. **Implement progressive disclosure** — For skills >200 lines, extract details into a `references/` subdirectory. Keep top-level SKILL.md under 200 lines.

3. **Document skill/memory boundary** — Write a section in each SKILL.md (or a central doc) clarifying when to use a skill vs. AGENTS.md context. Use DeepAgents' table as a template.

4. **Add conventional body sections** — Require `## Overview`, `## Instructions`, and `## Triggers` in all SKILL.md files. Optional: `## Examples`, `## Edge Cases`.

### Medium Priority

5. **Skill source layering** — Define explicit precedence (`~/.boomerang/skills/` < project `.boomerang/skills/` < inline skills) and document last-wins semantics.

6. **Skill validation in linter** — Add a `boomerang-linter` check that validates:
   - `name` matches directory name
   - `description` ≤ 1024 chars
   - Required frontmatter fields present

7. **Subagent skill inheritance model** — Define which skills a sub-agent inherits by default and how to override.

### Lower Priority (Future)

8. **`scripts/` support** — Allow skills to bundle helper scripts callable by the agent.

9. **`allowed-tools` field** — Implement tool allowlisting for skills as a security/cost measure.

10. **Skill marketplace** — Align with AgentSkills.io spec for potential future interoperability.

---

## 6. Files to Modify

| File | Change |
|------|--------|
| `.opencode/skills/*/SKILL.md` | Add `license`, `compatibility`, `metadata` frontmatter; enforce `## Overview`/`## Instructions` sections |
| `docs/deepagents-review.md` | This document |
| `AGENTS.md` | Add Skills vs Memory distinction section |
| `boomerang-linter` skill | Add SKILL.md frontmatter validation |

---

## 7. References

- [DeepAgents GitHub](https://github.com/langchain-ai/deepagents)
- [DeepAgents Skills Docs](https://docs.langchain.com/oss/python/deepagents/skills)
- [Agent Skills Specification](https://agentskills.io/specification)
- [Example Skill (langgraph-docs)](https://github.com/langchain-ai/deepagents/tree/main/libs/cli/examples/skills/langgraph-docs)

---

*Review complete — ready for implementation planning.*
