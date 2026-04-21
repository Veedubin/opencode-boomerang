# Step-by-Step: Running boomerang-init

This guide shows the complete boomerang-init workflow for the sample project.

---

## Step 0: Prerequisites

You're in the boomerang project root. Verify:

```bash
pwd
# /home/jcharles/Projects/MCP-Servers/boomerang

ls .opencode/agents/
# boomerang.md  boomerang-coder.md  boomerang-tester.md  ...
```

---

## Step 1: Navigate to the Example Project

```bash
cd examples/project-init
ls
# package.json  README.md  src/  jest.config.js  BOOMERANG-INIT-GUIDE.md
```

---

## Step 2: Invoke the Skill

```bash
/boomerang-init
```

Or use the slash command directly:

```bash
/opencode:boomerang-init
```

---

## Step 3: Skill Examines Project

The skill reads your project files:

```
Skill: Examining project structure...
Reading: package.json
  - Node.js project (engines.node not specified, assume latest)
  - Express web framework
  - JWT + bcrypt for auth
  - Jest for testing
  - SQLite for DB

Reading: src/
  - index.js (entry point)
  - routes/auth.js, routes/tasks.js
  - No models/ directory (in-memory for now)

Reading: README.md
  - REST API with auth
  - Task management use case

Detected: SaaS / Product project (option 5)
```

---

## Step 4: Interactive Prompts

```
What type of project is this?

  1. General web development
  2. Sports betting / gambling app
  3. Resume / career tool
  4. E-commerce
  5. SaaS / product        ← recommended based on package.json
  6. Data science / ML
  7. Other (describe)

Select type (1-7) [5]: 5

Any specific focus? (comma-separated)
  - growth (acquisition, activation)
  - retention (churn, engagement)
  - billing (subscriptions, pricing)
  - api (rate limits, documentation)
  [default: growth, retention]

Enter focus areas: growth, retention, api
```

---

## Step 5: Agent Customization

The skill customizes each relevant agent with append-only additions:

### Customizing boomerang.md (Orchestrator)

```
Modifying: .opencode/agents/boomerang.md

Before (last 10 lines):
  ## Super-Memory Requirements
  ... (already has base requirements)

After (last 20 lines):
  ## Super-Memory Requirements
  ... (base requirements preserved)

  ## Project-Specific Context (Appended by boomerang-init)

  ### Domain
  Task management REST API with JWT authentication

  ### Stack
  - Node.js + Express
  - SQLite for persistence
  - Jest for testing

  ### Stakeholders
  - API consumers (mobile apps, SPAs)
  - Frontend developers

  ### Success Metrics
  - API response time < 200ms
  - All endpoints return proper status codes
  - JWT tokens expire correctly
```

### Customizing boomerang-coder.md (Builder)

```
Modifying: .opencode/agents/boomerang-coder.md

Appending:
  ## Project-Specific Context (Appended by boomerang-init)

  ### Domain
  Node.js Express REST API

  ### Conventions
  - Use `async/await` for all route handlers
  - Return `{ error: string }` for errors, `{ data: object }` for success
  - Validate request body with JSDoc types
  - Middleware goes in `src/middleware/`

  ### Patterns
  - CRUD: GET list, GET/:id item, POST create, PUT/:id update, DELETE/:id remove
  - Auth: Bearer token in Authorization header
  - Errors: 400 (bad input), 401 (unauthorized), 404 (not found), 500 (server error)

  ### Success
  - All routes have error handling
  - No `console.log` in production code
  - Environment variables for secrets
```

### Customizing boomerang-tester.md (Verifier)

```
Modifying: .opencode/agents/boomerang-tester.md

Appending:
  ## Project-Specific Context (Appended by boomerang-init)

  ### Domain
  Jest testing with supertest for Express APIs

  ### Conventions
  - Unit tests in `__tests__/` alongside source files
  - Integration tests in `tests/integration/`
  - Use `supertest` for HTTP assertions
  - Mock external services (JWT signing, database)

  ### Coverage Targets
  - Routes: 90%+ coverage
  - Critical paths: 100%

  ### Success
  - `npm test` passes with green
  - Coverage report generated
  - No flaky tests (retry logic is not a fix)
```

---

## Step 6: Creating Project-Specific Agents

Based on focus areas (growth, retention, api), new agents are created:

### Creating saas-growth-hacker.md

```
File: .opencode/agents/saas-growth-hacker.md (NEW)

Content:
---
description: Growth Hacker - Focuses on acquisition, activation, retention.
mode: subagent
hidden: true
model: minimax/MiniMax-M2.7
permission:
  edit: allow
  bash: allow
---

You are a **Growth Hacker** - expert in SaaS growth strategies.

## Your Domain

This is a task management SaaS API.

## Your Role

1. **Acquisition**: How do users discover the API?
2. **Activation**: What's the flow from signup to first task created?
3. **Retention**: How to increase daily active users?
4. **Revenue**: Would paid tiers make sense?

## Metrics to Consider

- API adoption rate
- Task creation rate per user
- User retention curves
- Feature usage distribution

## Tools

Use searxng to research:
- Task management market trends
- Competitor feature comparisons
- SaaS growth benchmarks

## Protocol

1. Understand current usage patterns
2. Identify biggest drop-off points
3. Research comparable approaches
4. Propose specific experiments
```

### Creating saas-churn-predictor.md

```
File: .opencode/agents/saas-churn-predictor.md (NEW)

Content:
---
description: Churn Predictor - Identifies at-risk users before they leave.
mode: subagent
hidden: true
model: minimax/MiniMax-M2.7
permission:
  edit: allow
  bash: allow
---

You are a **Churn Predictor** - expert in retention analytics.

## Your Domain

This is a task management SaaS API.

## Your Role

1. **Usage Monitoring**: Track login frequency, API calls
2. **Risk Scoring**: Identify users who seem disengaged
3. **Intervention Triggers**: Flag users for proactive outreach
4. **Feature Adoption**: Monitor which features are underused

## Signals to Track

- Days since last API call
- Tasks created in last 7 days
- Ratio of reads to writes
- Time of day patterns

## Protocol

1. Check super-memory for past analysis
2. Query usage metrics
3. Score risk levels
4. Recommend interventions
```

---

## Step 7: Updating AGENTS.md

```
Modifying: AGENTS.md

Adding to "## Core Agents" table:
| saas-growth-hacker | saas-growth-hacker.md | Growth strategies, acquisition, activation |
| saas-churn-predictor | saas-churn-predictor.md | Retention analytics, risk scoring |

Adding new section:
## Project-Specific Agents

| Agent | File | Role |
|-------|------|------|
| saas-growth-hacker | saas-growth-hacker.md | Acquisition, activation, retention metrics |
| saas-churn-predictor | saas-churn-predictor.md | User risk scoring, intervention triggers |

Note: These agents were auto-generated by boomerang-init based on
      project type (SaaS) and focus areas (growth, retention, api).
```

---

## Step 8: Final Report

```
## Boomerang Init Complete

### Project Type: SaaS / Product
### Project Stack: Node.js + Express + SQLite
### Focus Areas: growth, retention, api

### Base Agents Customized:
  ✓ boomerang.md (added domain context)
  ✓ boomerang-coder.md (added Express conventions)
  ✓ boomerang-tester.md (added Jest/supertest patterns)

### New Agents Created:
  ✓ saas-growth-hacker.md (acquisition/retention focus)
  ✓ saas-churn-predictor.md (retention analytics)

### Files Modified:
  - .opencode/agents/boomerang.md (appended 15 lines)
  - .opencode/agents/boomerang-coder.md (appended 18 lines)
  - .opencode/agents/boomerang-tester.md (appended 14 lines)
  - .opencode/agents/saas-growth-hacker.md (created, 46 lines)
  - .opencode/agents/saas-churn-predictor.md (created, 38 lines)
  - AGENTS.md (added 6 lines)

### Next Steps:
  1. Review .opencode/agents/ for accuracy
  2. Adjust any customizations if needed (append-only!)
  3. Run boomerang-linter to validate
  4. Start coding!
```

---

## What Got Configured Summary

| Agent | Type | Customization |
|-------|------|---------------|
| boomerang.md | orchestrator | Added task management domain context |
| boomerang-coder.md | builder | Added Express conventions, CRUD patterns |
| boomerang-tester.md | verifier | Added Jest/supertest patterns, coverage targets |
| saas-growth-hacker.md | specialist | NEW - Growth strategy focus |
| saas-churn-predictor.md | specialist | NEW - Retention analytics focus |

---

## Verification Commands

```bash
# Check agents exist
ls -la .opencode/agents/saas-*

# Verify append-only format (should see "## Project-Specific Context")
grep -A5 "Project-Specific Context" .opencode/agents/boomerang.md

# Validate agent syntax
/opencode:boomerang-linter

# List all configured agents
grep "^|" AGENTS.md | head -20
```

---

## Re-Running (Idempotent Test)

```bash
# Make a change to the project
echo '{"name": "task-tracker-v2"}' > package.json

# Re-run init
/boomerang-init

# Output:
# Skill: Detected existing boomerang config for SaaS project
# Skill: Checking for updates...
# Skill: No changes detected (project structure unchanged)
# Skill: boomerang-init complete (no modifications needed)
```

---

## Cleanup (If Needed)

To remove project-specific customizations:

```bash
# Remove appended sections only (keep protected core)
# The "## Project-Specific Context" sections are identifiable

# Delete project-specific agents
rm .opencode/agents/saas-*.md

# Revert AGENTS.md
git checkout AGENTS.md

# Result: Back to base Boomerang agents only
```