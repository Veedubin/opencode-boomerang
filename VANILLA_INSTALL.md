# Vanilla OpenCode Install

Copy the prompt below and paste it into a fresh OpenCode Builder session. It will automatically download, configure, and set up Boomerang for you.

---

```text
I want you to install the Boomerang multi-agent plugin for OpenCode. Do this step by step:

1. Install the Boomerang package from PyPI. Run: pip install opencode-boomerang (or uv tool install opencode-boomerang if uv is available).

2. Install super-memory from PyPI. Run: pip install super-memory (or uv tool install super-memory if uv is available).

3. Edit the project's .opencode/opencode.json file to include:
   - The Boomerang plugin: "plugin": ["opencode-boomerang"]
   - An MCP server entry for super-memory with command ["super-memory"] or ["uv", "run", "super-memory"] depending on how it was installed
   - An MCP server entry for sequential-thinking with command ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]

4. Confirm completion and tell me to:
   a) Restart OpenCode completely
   b) After restart, open the Skills panel (type /skills) and select "boomerang-init" to run the initialization skill
```

---

After installation completes, restart OpenCode and run the `/boomerang-init` skill to finalize setup.