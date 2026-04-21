# Super-Memory Best Practices for Boomerang Agents

> **Document Version**: 0.1.0  
> **Last Updated**: 2026-04-20  
> **Status**: Best Practices Guide — Ready for Adoption  
> **Scope**: All Boomerang agents (orchestrator, coder, tester, explorer, linter, git, writer, scraper)

---

## Table of Contents

1. [Overview](#overview)
2. [The Memory Protocol](#the-memory-protocol)
3. [What to Save](#what-to-save)
4. [What NOT to Save](#what-not-to-save)
5. [Memory Entry Structure](#memory-entry-structure)
6. [Query Strategies](#query-strategies)
7. [Memory Hygiene](#memory-hygiene)
8. [Handling Failures Gracefully](#handling-failures-gracefully)
9. [Good vs. Bad Examples](#good-vs-bad-examples)
10. [Quick Reference Checklist](#quick-reference-checklist)

---

## Overview

Super-memory is Boomerang's shared knowledge layer. Every agent must:

1. **Query at start** — Retrieve relevant context before beginning work
2. **Save at end** — Persist decisions, patterns, and outcomes for future agents

Without consistent memory practices, agents repeat failures, ignore established patterns, and waste time rediscovering information that was already learned.

---

## The Memory Protocol

Every Boomerang session follows this protocol:

```
┌─────────────────────────────────────────────────────────┐
│                    SESSION LIFECYCLE                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   1. START:  query_memory() → get relevant context      │
│                 ↓                                        │
│   2. WORK:   execute task with retrieved context        │
│                 ↓                                        │
│   3. END:    save_to_memory() → persist learnings       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Session Start — Mandatory Query

Before any agent begins work, it MUST call `query_memory()`:

```typescript
// Always do this first — before any tool calls
const context = await query_memory({
  question: "What does the next agent need to know about this task?",
  top_k: 5
});
```

### Session End — Mandatory Save

When an agent completes work, it MUST save:

```typescript
// Always do this last — before returning control
await save_to_memory({
  content: "Key decision: chose approach X because Y. Future agents should..."
});
```

---

## What to Save

### ✅ Decisions & Rationale

Save the **why** behind decisions, not just the what.

| Category | What to Save | Example |
|----------|--------------|---------|
| **Architectural choices** | Why a specific approach was selected | "Chose adapter pattern for LLM providers because it allows runtime provider swapping without code changes" |
| **Tool selections** | Why this tool over alternatives | "Used `sed` instead of `awk` because the file had consistent colon delimiters and we needed simple field extraction" |
| **Trade-off conclusions** | Explicit trade-offs that were made | "Prioritized speed over completeness for initial scan — detailed analysis can be run on-demand |
| **Pattern adoptions** | Established patterns the team should follow | "All error handlers must return structured errors with code, message, and context fields" |

### ✅ Patterns & Conventions

Document patterns that future agents should replicate.

```markdown
# Pattern: Consistent Error Handling
All exported functions in src/utils/ must:
- Return Result<T, E> type (never throw)
- Include descriptive error messages with error codes
- Log at appropriate level (ERROR for failures, WARN for recoverable issues)
```

### ✅ Failures & Fixes

Record failures so future agents don't repeat them.

```markdown
# Failure: git rebase -i caused conflicts
Task: Update all TODO comments to issue links
Error: Rebase interactively caused merge conflicts in 12 files
Fix: Used `git filter-branch` instead, or do per-file edits before rebase
Prevention: Avoid interactive rebase on branches with many commits; use non-interactive methods for bulk changes
```

### ✅ User Preferences

Capture explicit and implicit user preferences.

```markdown
# User Preference: Code style
- User prefers TypeScript strict mode enabled
- User wants 2-space indentation (not tabs)
- User不喜欢注释用中文 — comments must be in English
- User requires all public APIs to have JSDoc comments
```

### ✅ Project-Specific Context

Store project knowledge that isn't in code.

```markdown
# Project Context: Backend API
- Monorepo structure: apps/api, packages/shared, packages/db
- API uses tRPC for type-safe RPC calls between frontend/backend
- Database migrations run via `pnpm db:migrate` (not npm)
- Secrets stored in 1Password, not in .env files
```

### ✅ Cross-Agent Handoffs

Document what the next agent needs to know.

```markdown
# Handoff: auth refactoring task
Completed: Identified all auth-related files (12 files)
Remaining: Update auth middleware to support new token format
Blocked by: Waiting for security team to approve token spec
Next step: Review packages/auth/ middleware.ts once approval comes through
```

---

## What NOT to Save

### ❌ Transient Data

Do not save temporary or one-time-use information.

| Avoid Saving | Reason |
|--------------|--------|
| **File contents** | Store patterns, not file snapshots |
| **Exact command outputs** | Save the meaning, not the raw output |
| **Session-specific variables** | Only save cross-session knowledge |
| **Build artifacts** | Not relevant to other agents |
| **Debug traces** | Save the conclusion, not the trace |

**Bad**: "Output of `ls -la` was: total 48 drwxr-xr-x  8 jcharles staff  256 Apr 20 10:00 src"

**Good**: "Source code is in src/ directory. All TypeScript files use .ts extension (not .tsx unless React component)."

### ❌ Redundant Information

Don't duplicate what already exists in code or docs.

| Don't Repeat | Where It Lives |
|--------------|----------------|
| Function signatures | Source code |
| API schemas | OpenAPI/spec files |
| Configuration values | opencode.json, config files |
| Already-documented patterns | Existing docs/ directory |

**Bad**: "The function `calculateTotal(items: LineItem[]): number` takes an array of line items and returns a number."

**Good**: "Use `calculateTotal()` from src/billing/calculations.ts for order totals — handles edge cases like discounts and taxes."

### ❌ Speculative Information

Don't save guesses or unverified conclusions.

| Don't Save | What to Do Instead |
|------------|---------------------|
| "Probably needs refactoring" | Save after confirming with quality gates |
| "Might be a bug" | Save only after reproducing and identifying root cause |
| "User probably wants X" | Verify with user or explicit task description first |

---

## Memory Entry Structure

### Required Fields

Every memory entry must include:

```typescript
{
  content: string;      // The actual knowledge to save
  metadata?: {          // Optional but strongly recommended
    project?: string;   // Project name or "global" for cross-project
    agent?: string;     // Which agent created this (e.g., "boomerang-coder")
    taskType?: string;  // Task category (e.g., "refactoring", "testing", "bugfix")
    tags?: string[];    // For filtering (e.g., ["typescript", "auth", "performance"])
  }
}
```

### Structural Templates

Use these templates depending on content type:

#### Pattern Documentation

```markdown
# Pattern: [Pattern Name]

## When to Use
[Condition that indicates this pattern applies]

## Implementation
[How to implement it]

## Example
```typescript
[Code example]
```

## Related
[Links to related patterns or docs]
```

#### Decision Record

```markdown
# Decision: [What was decided]

## Context
[What problem needed solving]

## Options Considered
1. [Option A] — [pros/cons]
2. [Option B] — [pros/cons]

## Resolution
[What was chosen and why]

## Consequences
[Expected outcomes, both positive and negative]
```

#### Failure Log

```markdown
# Failure: [What failed]

## Symptoms
[How the failure manifested]

## Root Cause
[Why it happened]

## Fix Applied
[How it was resolved]

## Prevention
[How to avoid in the future]
```

---

## Query Strategies

### What to Ask

Structure your query based on what you need:

| Need | Query Strategy |
|------|----------------|
| **Restarting interrupted work** | "What was the last thing done on [task description]?" |
| **Avoiding repeated failures** | "What failures have occurred when working on [area]?" |
| **Understanding patterns** | "What patterns are established for [language/framework/area]?" |
| **Finding relevant context** | "What do I need to know about [project/file/feature]?" |
| **Handoff context** | "What should the next agent know about [task]?" |

### How to Phrase Queries

**Good queries** — Specific, focused, actionable:

```
"What patterns should I follow for error handling in src/api/?"

"What failures have occurred when working with git merge in this repo?"

"What did the previous session accomplish on the auth refactoring?"
```

**Bad queries** — Too vague, too broad:

```
"Everything about this project"

"Tell me what to do"

"What is the codebase about?"
```

### Query Parameters

- **`top_k`**: Use 3-5 for most queries. Use higher values (8-10) when doing research or exploring unfamiliar areas.
- **Phrasing**: Ask as questions that a teammate would understand, not as keywords.
- **Iteration**: If first query doesn't yield useful results, rephrase and try again with different terms.

---

## Memory Hygiene

### When to Update vs. Create New

| Scenario | Action |
|----------|--------|
| **Correcting outdated info** | Update the existing entry (find with query, replace content) |
| **New pattern discovered** | Create new entry (don't overwrite similar patterns) |
| **Same failure recurs** | Update existing failure log with new occurrence, add prevention if new |
| **User preference changes** | Update existing preference entry, note the change date |
| **Contradiction found** | Create new entry noting the contradiction, keep old for history |

### Update Frequency

| Entry Type | When to Update |
|------------|----------------|
| **Patterns** | When implementation changes or better pattern discovered |
| **Decisions** | When circumstances change and decision must be revisited |
| **Failure logs** | Add new occurrences to existing log, don't create duplicates |
| **User preferences** | When user explicitly changes preference or agent observes new behavior |
| **Handoffs** | Never update — create fresh each session |

### Entry Lifecycle

```
Created → Referenced → Updated (if needed) → Superseded (if outdated)
                    ↓
              Marked as stale only if explicitly contradicted
```

**Do NOT delete** old entries unless they are actively misleading. Stale entries serve as historical record.

---

## Handling Failures Gracefully

### Super-Memory Unavailable

If `save_to_memory()` fails:

```typescript
// Wrap save operations in try/catch
try {
  await save_to_memory({ content: "..." });
} catch (error) {
  // Log the failure but don't block completion
  console.warn("Failed to save to super-memory:", error.message);
  // Continue — task completion is more important than memory save
}
```

If `query_memory()` fails:

```typescript
// Always have a fallback — don't assume memory is populated
const context = await query_memory({ question: "...", top_k: 5 })
  .catch(() => ({ results: [], error: "Memory unavailable" }));

// Proceed with empty context rather than failing
if (!context.results.length) {
  console.warn("No memory context available — proceeding without it");
}
```

### Partial Failures

If saving multiple entries and some fail:

```typescript
const entries = [decision, pattern, handoff];
for (const entry of entries) {
  try {
    await save_to_memory(entry);
  } catch (error) {
    console.warn(`Failed to save entry: ${error.message}`);
    // Continue with remaining entries
  }
}
```

### Lance Database Errors

If you encounter Lance-specific errors (the underlying storage):

```typescript
// These are typically transient — retry once
try {
  await save_to_memory({ content: "..." });
} catch (error) {
  if (error.message.includes("lance") || error.message.includes("Not found")) {
    // Retry once
    await new Promise(r => setTimeout(r, 1000));
    await save_to_memory({ content: "..." });
  } else {
    throw error; // Non-retryable error
  }
}
```

---

## Good vs. Bad Examples

### Good Memory Entries

#### Decision with Rationale

```markdown
# Decision: Use adapter pattern for LLM providers

## Context
Need to support multiple LLM providers (OpenAI, Anthropic, local Ollama) without
hardcoding provider selection throughout the codebase.

## Resolution
Created ProviderAdapter interface with generate(), stream(), embed() methods.
Each provider implements this interface and registers with ProviderRegistry.

## Why Not Alternatives
- Strategy pattern: Doesn't fit because providers have different API shapes
- Factory pattern: Doesn't allow runtime swapping or health checking
- Direct integration: Would scatter provider-specific code throughout codebase

## Consequences
Positive: New providers can be added by implementing one interface
Negative: Requires understanding interface contracts before implementing new provider
```

#### User Preference (Specific)

```markdown
# User Preference: TypeScript strict mode

User has enabled strict mode in tsconfig.json and expects:
- No implicit any types (explicit `: any` required)
- Strict null checks (must handle null/undefined explicitly)
- Strict function types (parameter types must match exactly)

All new code must pass strict mode checks. PRs will be rejected if they
introduce new strict mode violations.
```

#### Failure with Prevention

```markdown
# Failure: Interactive rebase caused data loss

## Symptoms
After running `git rebase -i HEAD~10`, 3 commits worth of changes disappeared
from the branch. Reflog showed commits were orphaned but recoverable.

## Root Cause
Editor (vim) was configured with incorrect settings, causing some lines to
be misinterpreted as actions rather than pick commands.

## Fix
Used `git reflog` and `git reset --hard` to recover the orphaned commits.
Rebased remaining commits non-interactively using `git rebase -p --exec` or
by breaking into individual commits first.

## Prevention
1. When doing interactive rebase with many commits, use `--exec` for non-interactive
2. Backup branch before rebase: `git branch backup-branch`
3. If vim is required, verify edit buffer before saving
```

### Bad Memory Entries

#### Too Vague

```markdown
❌ BAD: "Need to be careful with the auth code. It's complex and has bugs."
```

**Problem**: No actionable information. Future agent doesn't know what to do differently.

```markdown
✅ GOOD: "Auth module has two known issues:
1. Token refresh race condition — see src/auth/token.ts:47-89
2. Session expiry not handled — users stay logged in after server restart
All auth changes require testing with multiple concurrent requests."
```

#### Saves File Contents

```markdown
❌ BAD: "File src/utils/helpers.ts contains:
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}
..."
```

**Problem**: File contents belong in the filesystem, not memory. Doesn't teach pattern.

```markdown
✅ GOOD: "Date utilities live in src/utils/helpers.ts.
Pattern: All date functions accept/return Date objects internally but
serialize as ISO strings at API boundaries.
New date utilities should follow this pattern for consistency."
```

#### Saves Raw Output

```markdown
❌ BAD: "Build output: 'ERROR src/api/users.ts(42,10): missing return statement'
```

**Problem**: Raw error messages don't teach. Error may be fixed already.

```markdown
✅ GOOD: "Common pattern: missing return statements in async route handlers.
Always verify all code paths return a value or throw. ESLint rule
'no-unreachable' catches most cases. TypeScript's 'strict' mode helps identify
potentially unreachable code."
```

#### Speculative

```markdown
❌ BAD: "I think the database might need indexing soon. Not sure though."
```

**Problem**: Unverified guess pollutes memory and wastes future agent time.

```markdown
✅ GOOD: (Don't save until verified)
If later verified: "Performance issue: users table missing index on email column.
Query `SELECT * FROM users WHERE email = ?` takes 800ms on 1M rows.
Solution: Add index or use cached lookup. See packages/db/schema.prisma:23."
```

---

## Quick Reference Checklist

### Before You Start (Query Phase)

- [ ] Call `query_memory()` with task-relevant question
- [ ] Review top 3-5 results for relevant context
- [ ] If no relevant results, proceed without assuming prior knowledge
- [ ] Note any handoffs or continuations from previous sessions

### After You Complete (Save Phase)

- [ ] Save at least one memory entry per session
- [ ] Include what was decided and why (not just what was done)
- [ ] Include prevention advice for any failures encountered
- [ ] Tag entries appropriately for future retrieval
- [ ] Use consistent formatting (see templates above)
- [ ] Wrap saves in try/catch to handle failures gracefully

### Memory Quality

- [ ] Content is actionable — future agent knows what to do
- [ ] Content is specific — avoids vague generalizations
- [ ] Content is verified — don't save speculation
- [ ] Content is non-redundant — doesn't repeat existing docs
- [ ] Content is project-scoped — tagged appropriately

---

## Related Documents

- [AGENTS.md](../AGENTS.md) — Agent roster and roles
- [HANDOFF.md](../HANDOFF.md) — Session handoff protocol
- [TASKS.md](../TASKS.md) — Task definitions and priorities
- [backlog-architecture.md](./backlog-architecture.md) — Architecture specifications
