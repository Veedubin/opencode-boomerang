/**
 * Boomerang v2 - OpenCode Plugin Interface
 * 
 * This is the actual plugin entry point that integrates with OpenCode's plugin system.
 * Provides commands: 'boomerang', '/handoff'
 * Registers agents and skills with OpenCode.
 */

import { createOrchestrator, type OrchestrationResult } from './orchestrator.js';
import { loadAgents, loadSkills, getAgent, getSkill } from './asset-loader.js';
import { getMemorySystem } from './memory/index.js';

// Plugin metadata
export const PLUGIN_NAME = '@veedubin/boomerang-v2';
export const VERSION = '4.0.0';

// Plugin context interface (OpenCode provides this)
export interface PluginContext {
  cwd: string;
  interactive: boolean;
  args: string[];
}

// Command handler signature
export type CommandHandler = (context: PluginContext) => Promise<void>;

// Registry interface provided by OpenCode
export interface PluginRegistry {
  registerCommand(name: string, handler: CommandHandler): void;
  registerAgent(name: string, definition: AgentDefinition): void;
  registerSkill(name: string, definition: SkillDefinition): void;
}

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
}

export interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
}

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

/**
 * Register the plugin with OpenCode's registry
 * Called by OpenCode during plugin initialization
 */
export function register(registry: PluginRegistry): void {
  // Load and register agents
  const agents = loadAgents();
  for (const agent of agents) {
    registry.registerAgent(agent.name, {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt || '',
      skills: agent.skills,
    });
  }

  // Load and register skills
  const skills = loadSkills();
  for (const skill of skills) {
    registry.registerSkill(skill.name, {
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
    });
  }

  // Register commands
  registry.registerCommand('boomerang', handleBoomerangCommand);
  registry.registerCommand('/handoff', handleHandoffCommand);
}

/**
 * Activate the plugin - initialize memory and prepare for execution
 * Called by OpenCode when plugin is first used
 */
export async function activate(context: PluginContext): Promise<void> {
  // Initialize memory system
  const memorySystem = getMemorySystem();
  try {
    await memorySystem.initialize(QDRANT_URL);
    console.log('[boomerang] Memory system initialized');
  } catch (error) {
    console.warn('[boomerang] Memory initialization failed (fallback mode):', error instanceof Error ? error.message : error);
  }

  // Handle commands
  const command = context.args[0];
  if (command === 'boomerang' || command === undefined) {
    await handleBoomerangCommand(context);
  } else if (command === '/handoff') {
    await handleHandoffCommand(context);
  }
}

/**
 * Handle boomerang command - analyze request and prepare context for OpenCode execution
 */
async function handleBoomerangCommand(context: PluginContext): Promise<void> {
  const request = context.args.slice(1).join(' ') || 'help';

  if (request === 'help') {
    console.log(`
Boomerang v${VERSION} - Multi-Agent Orchestration Plugin for OpenCode

Commands:
  boomerang <task>    - Orchestrate a task with appropriate agent
  boomerang /handoff  - End session and save context

Available agents:
  - boomerang: General purpose orchestrator
  - boomerang-coder: Fast code generation
  - boomerang-tester: Testing specialist
  - boomerang-explorer: Codebase exploration
  - boomerang-architect: Architecture and design
  - boomerang-writer: Documentation
  - boomerang-git: Version control
  - boomerang-linter: Quality enforcement
  - boomerang-release: Release automation
  - boomerang-scraper: Web research

Examples:
  boomerang implement user authentication
  boomerang test payment processing
  boomerang explore find files with API endpoints
    `);
    return;
  }

  try {
    // Create orchestrator and analyze request
    const orchestrator = createOrchestrator();
    const result = await orchestrator.orchestrate(request);

    // Log orchestration result for OpenCode to pick up
    console.log('[boomerang] Orchestration complete');
    console.log(`[boomerang] Agent: ${result.agent}`);
    console.log(`[boomerang] Context Package built with ${result.contextPackage.relevantFiles.length} relevant files`);
    console.log(`[boomerang] Suggestions:`, result.suggestions);

    // The actual execution happens via OpenCode's agent system
    // We just prepare the context package
  } catch (error) {
    console.error('[boomerang] Orchestration failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Handle handoff command - save context and prepare for session end
 */
async function handleHandoffCommand(context: PluginContext): Promise<void> {
  console.log('[boomerang] Starting session handoff...');

  try {
    const memorySystem = getMemorySystem();
    
    if (memorySystem.isInitialized()) {
      const summary = `Session handoff completed at ${new Date().toISOString()}`;
      await memorySystem.saveContext('handoff', summary);
      console.log('[boomerang] Context saved to memory');
    }

    console.log('[boomerang] Handoff complete. Session summary saved.');
  } catch (error) {
    console.error('[boomerang] Handoff failed:', error instanceof Error ? error.message : error);
  }
}

// Re-export public types and functions
export { createOrchestrator } from './orchestrator.js';
export type { OrchestrationResult, ContextPackage } from './orchestrator.js';
