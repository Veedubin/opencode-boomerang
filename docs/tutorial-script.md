# Boomerang Setup Tutorial - Video Script & Outline

## Tutorial Overview

**Title:** Getting Started with Boomerang - Multi-Agent Orchestration Made Simple

**Description:** A comprehensive beginner-friendly video walkthrough covering Boomerang installation, configuration, and first workflow. By the end, viewers will understand how to set up Boomerang and run their first orchestrated multi-agent task.

**Target Audience:** Developers and technical users interested in AI-assisted coding workflows, particularly those working with OpenCode or similar AI coding environments.

---

## Section-by-Section Script & Outline

### [0:00 - 0:30] Section 1: Introduction

**Duration:** 30 seconds

**On Screen:** Boomerang logo/hero graphic with animated agents delegating tasks

**Script:**
> "Hey everyone! Today we're diving into Boomerang - a powerful multi-agent orchestration system that lets you coordinate AI agents to handle complex coding tasks together. Think of it like having a project manager AI that delegates work to specialized agents like a coder, tester, and explorer. Stick around to see how it works!"

**Key Talking Points:**
- Boomerang is an orchestration layer for OpenCode
- Multiple agents work together under an orchestrator
- Each agent has a specialty (coder, tester, explorer, etc.)
- Simplifies complex multi-step coding workflows

---

### [0:30 - 1:30] Section 2: Prerequisites

**Duration:** 1 minute

**On Screen:** Terminal window showing prerequisite commands

**Script:**
> "Before we start, let's make sure you have everything needed. You'll need Node.js version 18 or higher installed. Check this by running 'node --version' in your terminal. You'll also need Git for version control, and of course, OpenCode. That's it - pretty lightweight requirements!"

**Key Talking Points:**
- Node.js 18+ required (check with `node --version`)
- Git for version control operations
- OpenCode as the base platform
- No complex dependencies or containers needed

---

### [1:30 - 3:30] Section 3: Installation

**Duration:** 2 minutes

**On Screen:** Terminal showing the installation process step-by-step

**Script:**
> "Let's get Boomerang installed. The easiest way is using the install prompt. Just run 'npx @opencode-mcp-servers/boomerang' - that's it! NPX will download and execute the package. You'll see the installer start up and guide you through a few simple options. The installer will set up the core files and directory structure automatically."

**Key Talking Points:**
- Use `npx @opencode-mcp-servers/boomerang` for quick install
- NPX handles execution without global install
- Installer creates necessary directory structure
- Automatic dependency resolution

**Screen Recording Notes:**
- Show terminal with npx command
- Show installer prompts and responses
- Highlight the created directory structure

---

### [3:30 - 6:00] Section 4: Configuration (opencode.json Setup)

**Duration:** 2.5 minutes

**On Screen:** File explorer + VS Code showing opencode.json structure

**Script:**
> "Now for the configuration. Boomerang uses an 'opencode.json' file to understand your project structure and preferences. In your project root, you'll configure things like the agents roster - telling Boomerang which agents are available and their capabilities. You'll also set up memory configuration for how agents store context. Let me show you a typical configuration..."

**Key Talking Points:**
- opencode.json is the main configuration file
- Agents roster defines available agents and their skills
- Memory settings control context persistence
- Configuration is declarative and human-readable

**Screen Recording Notes:**
- Show example opencode.json structure
- Highlight key sections: agents, memory, skills
- Show validation of JSON structure

---

### [6:00 - 8:30] Section 5: First Use (Running boomerang-init)

**Duration:** 2.5 minutes

**On Screen:** Terminal showing initialization process

**Script:**
> "Time to initialize Boomerang for your project. Run 'boomerang-init' - this wizard helps you personalize agents for your specific needs. It'll ask about your project type, coding preferences, and which agents you want active. The init process creates personalized agent configurations that remember your preferences across sessions. It's like setting up your dream team!"

**Key Talking Points:**
- Run `boomerang-init` to start the setup wizard
- Customize agents for your project type
- Preferences are saved for future sessions
- Can be re-run to refresh agent configurations

**Screen Recording Notes:**
- Show boomerang-init wizard prompts
- Show selections being made
- Show completion message with next steps

---

### [8:30 - 11:30] Section 6: Example Workflow (Orchestrator Delegating to Coder)

**Duration:** 3 minutes

**On Screen:** Split view - Boomerang UI + actual task execution

**Script:**
> "Let's see it in action! Here I have a coding task - I want to add user authentication to my project. Instead of doing it myself, I'll use the orchestrator agent. The orchestrator analyzes the task, breaks it down, and delegates to specialized agents. See how it automatically calls the coder agent to write the implementation, then the tester agent to verify it works? That's the power of orchestration - each agent does what it does best, coordinated by the orchestrator."

**Key Talking Points:**
- Orchestrator receives the initial task
- Task is analyzed and decomposed into steps
- Specialized agents are called as needed
- Results are synthesized by the orchestrator
- Human oversight available at key points

**Screen Recording Notes:**
- Show task submission to orchestrator
- Show agent delegation messages
- Show intermediate results flowing between agents
- Show final synthesized result

---

### [11:30 - 13:00] Section 7: Tips and Best Practices

**Duration:** 1.5 minutes

**On Screen:** Animated tips with code snippets

**Script:**
> "A few tips to get the most out of Boomerang. First, be clear and specific in your tasks - the better you describe what you want, the better the orchestrator can delegate. Second, start simple and iterate - get comfortable with basic workflows before tackling complex multi-agent scenarios. Third, use the memory features - Boomerang's context persistence is a game-changer for related tasks. And finally, check out the documentation for advanced configurations. Links are in the description!"

**Key Talking Points:**
- Be specific when describing tasks to orchestrator
- Start with simple workflows, then complexity
- Leverage memory features for related tasks
- Review documentation for advanced usage
- Join the community for tips and workflows

---

### [13:00 - 13:30] Conclusion

**Duration:** 30 seconds

**On Screen:** Boomerang branding with links

**Script:**
> "And that's it! You're ready to start orchestrating like a pro. Remember, Boomerang turns your AI coding workflow into a coordinated team effort. Links to documentation and community resources are below. Give it a try and let me know how it goes - I'll see you in the next one!"

**Key Talking Points:**
- Recap: installation is simple, configuration is flexible
- Encourage trying it out
- Point to documentation and community
- CTA: like, subscribe, feedback welcome

---

## Visual Cue Summary

| Section | Visual | Mood/Tone |
|---------|--------|-----------|
| Introduction | Animated agent network graphic | Exciting, modern |
| Prerequisites | Terminal with green checkmarks | Clean, informative |
| Installation | Terminal recording | Straightforward |
| Configuration | Split view editor + output | Technical but clear |
| First Use | Wizard UI progression | Friendly, approachable |
| Example Workflow | Split view, message flow | Dynamic, demonstrative |
| Tips | Animated bullet points | Helpful, concise |
| Conclusion | Branding slide with links | Professional wrap-up |

---

## Total Estimated Runtime: ~13-14 minutes

| Section | Duration |
|---------|----------|
| Introduction | 30s |
| Prerequisites | 1m |
| Installation | 2m |
| Configuration | 2.5m |
| First Use | 2.5m |
| Example Workflow | 3m |
| Tips & Best Practices | 1.5m |
| Conclusion | 30s |

---

## Post-Production Notes

- **B-roll suggestions:** Code flowing between agents animation, terminal recording with syntax highlighting, agent conversation visualization
- **Chapters:** Add chapter markers at each section start for easy navigation
- **Thumbnails:** Suggested thumbnail shows Boomerang logo with "Setup" text overlay
- **End screen:** Add cards linking to advanced documentation and community Discord
