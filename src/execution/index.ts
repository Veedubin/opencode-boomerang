/**
 * Execution Engine - Public API
 * 
 * Only exports what still exists after the hard refactor.
 * AgentSpawner and subprocess execution are DELETED.
 * TaskRunner is kept as a prompt builder only (no execution).
 */

export { AgentPromptLoader, DEFAULT_AGENT_DIRS, DEFAULT_SKILL_DIRS, type AgentPrompt } from './agent-prompts.js';
export { DocTracker, getDocTracker, type DocChange, type DocTrackerConfig } from './doc-tracker.js';
export { TaskRunner, type Task, type ExecutionContext, type TaskExecutionResult } from './task-runner.js';
