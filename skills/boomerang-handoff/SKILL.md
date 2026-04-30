---
name: boomerang-handoff
description: Wrap-up function for ending a session cleanly. Updates all documentation files and saves context for the next session.
---

# Boomerang Handoff

## Description

Wrap-up function for ending a session cleanly. Updates AGENTS.md, TASKS.md, HANDOFF.md, and README.md with current state, then saves context to super-memory. Run this when you want to "wrap it up" and start fresh in a new session.

**Usage**: `/handoff`

## Context Requirements (from Orchestrator)

You MUST receive:
1. **Session Accomplishments** — What was done this session
2. **Pending Tasks** — What remains unfinished
3. **Decisions Made** — Key architectural or design decisions
4. **Files Modified** — List of changed files
5. **Next Session Priorities** — What to tackle next

## Handoff Protocol (MANDATORY)

### Documentation Updates (ALL of these)
1. **Update HANDOFF.md**
   - Add new session entry at top
   - Include: date, status, accomplishments, key decisions, files modified, known issues, next priorities
   - Update "Last Updated" timestamp

2. **Update TASKS.md**
   - Mark completed tasks as done
   - Add new tasks discovered
   - Remove outdated tasks
   - Update priorities

3. **Update AGENTS.md** (if agent changes made)
   - Update agent roster
   - Update version numbers
   - Update review notes

4. **Update README.md** (if user-facing changes)
   - Update version badges
   - Update feature lists
   - Update installation instructions

### Super-Memory Save
- Save comprehensive session summary to `super-memory_add_memory`
- Include: all accomplishments, decisions, files, issues
- Tag with `project` metadata for high-value context
- Include query hints for easy retrieval

### Todo List Maintenance
- Mark all completed items as `completed`
- Remove old completed items (keep only last 5-10)
- Add any new pending items
- Ensure list is clean and relevant

## When to Use

- **End of session**: User says "wrap it up", "done for now", "let's stop"
- **Context limit approaching**: When context usage reaches ~40%, run handoff before compaction
- **Major milestone**: After completing a significant feature or phase
- **Switching topics**: Before moving to a completely different area of work

## Handoff Process

```
1. Gather current state from all active agents
2. Update AGENTS.md with current agent roster
3. Update TASKS.md with task status
4. Write HANDOFF.md with session summary
5. Update README.md if project changed
6. Save all context to super-memory
7. Report handoff complete
```

## File Update Details

### AGENTS.md

Documents:
- All active agents and their roles
- Models assigned to each agent
- Any customizations or special instructions
- New agents created during the session

### TASKS.md

Captures:
- Completed tasks (with checkmarks)
- In-progress tasks (with current status)
- Pending tasks (backlog)
- Blocked tasks (with blockers noted)

### HANDOFF.md

Summarizes:
- Session date and duration
- What was accomplished
- Key decisions made
- Code changes summary
- Where to resume next session
- Any warnings or important notes
- Reference to super-memory for detailed context

### README.md

Updates (only if project structure changed):
- Architecture changes
- New features added
- Installation steps modified
- Configuration changes

## Output Format (Return to Orchestrator)

```markdown
## Handoff Complete

### Files Updated
- HANDOFF.md ✅
- TASKS.md ✅
- AGENTS.md ✅ (if agent changes)
- README.md ✅ (if user-facing changes)

### Super-Memory
- Session context saved with project tag

### Todo List
- Updated and cleaned

### Resume Instructions
Next session should:
1. Read HANDOFF.md
2. Read TASKS.md
3. Query super-memory for detailed decisions
```

## Fallback Behavior

If any file update fails:
- Log the failure
- Save as much as possible to super-memory
- Report what succeeded and what failed
- Suggest manual fixes if needed
