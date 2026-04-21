# Boomerang Init - Project Initialization Guide

This example demonstrates how to use `boomerang-init` to configure Boomerang agents for a Node.js Express project.

## Reference

See the full skill documentation at:
```
../../../.opencode/skills/boomerang-init/SKILL.md
```

---

## Step 1: Examine Your Project Structure

Before running boomerang-init, understand what you have:

```
examples/project-init/
├── package.json          # Node.js + Express project
├── jest.config.js        # Testing with Jest
├── README.md             # Project documentation
└── src/
    ├── index.js          # Express server entry point
    └── routes/
        ├── auth.js       # Authentication endpoints
        └── tasks.js      # Task CRUD endpoints
```

**Key indicators:**
- `package.json` → Node.js project
- `express` dependency → REST API
- `jest` + `supertest` → API testing
- No TypeScript, no Docker → Simple deployment

---

## Step 2: Invoke boomerang-init

Run the skill in your project directory:

```bash
cd examples/project-init
/opencode:boomerang-init
# or
/boomerang-init
```

---

## Step 3: Interactive Session

The skill will examine your project and prompt:

```
Skill: Examining project structure...
Found: package.json, src/routes/, jest.config.js
Detected: REST API / SaaS project

What type of project is this?
1. General web development    ← likely correct
2. Sports betting / gambling app
3. Resume / career tool
4. E-commerce
5. SaaS / product            ← also reasonable
6. Data science / ML
7. Other (describe)

Select type (1-7): 5
```

---

## Step 4: What Gets Customized

Based on project type, boomerang-init appends to base agents:

### `boomerang.md` (Orchestrator)

```markdown
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

### `boomerang-coder.md` (Builder)

```markdown
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

### `boomerang-tester.md` (Verifier)

```markdown
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

## Step 5: Project-Specific Agents Created

For a SaaS/API project, these specialists are generated:

### `.opencode/agents/saas-growth-hacker.md`

```markdown
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

### `.opencode/agents/saas-churn-predictor.md`

```markdown
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

## Example Output

Running `/boomerang-init` produces this summary:

```
## Boomerang Init Complete

### Project Type: SaaS / Product
### Project Stack: Node.js + Express + SQLite

### Base Agents Customized:
- boomerang.md (added domain context)
- boomerang-coder.md (added Express conventions)
- boomerang-tester.md (added Jest/supertest patterns)

### New Agents Created:
- saas-growth-hacker.md (acquisition/retention focus)
- saas-churn-predictor.md (retention analytics)

### Files Modified:
- .opencode/agents/boomerang.md
- .opencode/agents/boomerang-coder.md
- .opencode/agents/boomerang-tester.md
- .opencode/agents/saas-growth-hacker.md (new)
- .opencode/agents/saas-churn-predictor.md (new)
- AGENTS.md (updated with new agents)

### Next Steps:
1. Review .opencode/agents/ for accuracy
2. Adjust any customizations if needed
3. Run boomerang-linter to validate
4. Start coding!
```

---

## Running in Your Own Project

### Prerequisites

```bash
# Ensure boomerang is set up
ls -la .opencode/agents/

# Should show base agents:
# boomerang.md, boomerang-coder.md, boomerang-tester.md, etc.
```

### Full Flow

```bash
# 1. Navigate to your project
cd /path/to/your/project

# 2. Run the init skill
/boomerang-init

# 3. Answer the prompts:
# - Project type (1-7)
# - Any specific focus areas

# 4. Review the generated agents
ls -la .opencode/agents/

# 5. Validate with linter
/boomerang-linter

# 6. Start coding!
```

### Idempotent - Safe to Re-run

boomerang-init is idempotent. Re-running it:
- Updates existing agents if project changed
- Adds new agents for expanded scope
- Preserves your manual customizations
- Does NOT overwrite core agent logic

---

## Customization Options

### Appending to Personas

Add project-specific context to agent descriptions:

```markdown
## Project-Specific Context (Appended by boomerang-init)

### Domain
[What your project does]

### Conventions
- [Coding standard 1]
- [Coding standard 2]

### Stakeholders
- [Who uses this]

### Success Metrics
- [What good looks like]
```

### Tool Preferences

```markdown
### Preferred Tools
- Use `supertest` for API testing
- Use `helmet` for security headers
- Use `express-validator` for input validation
```

### Project Conventions

```markdown
### Conventions
- File naming: `kebab-case.js`
- Error format: `{ error: string, code: number }`
- Date format: ISO 8601
- Authentication: Bearer token
```

---

## What NOT to Modify

These are **PROTECTED** and cannot be changed:

1. The 6-Step Boomerang Protocol
2. Agent selection rules
3. Mandatory step ordering
4. Quality gate requirements
5. Context compaction rules
6. Sub-agent requirements

See `.opencode/skills/boomerang-init/SKILL.md` for full details.

---

## Troubleshooting

### "Project type unclear"

If boomerang-init can't determine project type, it will:
- Ask you to select from options 1-7
- Use "General Development" as fallback
- Add a generic domain-expert agent

### "Agents not loading"

Check the agent files exist:
```bash
ls -la .opencode/agents/
```

Each agent should have:
- YAML frontmatter (`---`)
- `description` field
- `mode: subagent` or `mode: orchestrator`

### "Customizations lost"

boomerang-init only APPENDS. If customizations are missing:
- Check the append format is correct
- Ensure you're not editing PROTECTED sections
- Re-run boomerang-init to re-apply

---

## Related Skills

- `boomerang-linter` - Validate agent configurations
- `boomerang-orchestrator` - Coordinate multi-agent workflows
- `boomerang-handoff` - Save context when wrapping up