/**
 * Boomerang v4.0.0 - OpenCode Plugin Interface
 * 
 * Self-contained plugin that integrates with OpenCode's plugin system.
 * No cross-package imports from root boomerang-v2/src/.
 */

import { tool } from '@opencode-ai/plugin';
import { createOrchestrator } from './orchestrator.js';
import { loadAgents, loadSkills, listAvailableAgents, listAvailableSkills } from './asset-loader.js';
import { getMemorySystem } from './memory.js';
import { runAllQualityGates, DEFAULT_QUALITY_GATES } from './quality-gates.js';
import type { BoomerangConfig, PluginContext } from './types.js';

export { createOrchestrator } from './orchestrator.js';
export type { OrchestrationResult, ContextPackage } from './orchestrator.js';

const VERSION = '4.0.0';

// Default configuration
const DEFAULT_CONFIG: BoomerangConfig = {
  memoryEnabled: true,
  qualityGates: {
    lint: true,
    typecheck: true,
    test: true,
  },
};

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

/**
 * Plugin registration with OpenCode
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

export interface PluginRegistry {
  registerCommand(name: string, handler: CommandHandler): void;
  registerAgent(name: string, definition: AgentDefinition): void;
  registerSkill(name: string, definition: SkillDefinition): void;
}

interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
}

interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
}

type CommandHandler = (context: PluginContext) => Promise<void>;

/**
 * Plugin activation - initialize memory and prepare for execution
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
    const orchestrator = createOrchestrator();
    const result = await orchestrator.orchestrate(request);

    console.log('[boomerang] Orchestration complete');
    console.log(`[boomerang] Agent: ${result.agent}`);
    console.log(`[boomerang] Context Package built with ${result.contextPackage.relevantFiles.length} relevant files`);
    console.log(`[boomerang] Suggestions:`, result.suggestions);
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
      await memorySystem.saveContext(context.cwd, summary);
      console.log('[boomerang] Context saved to memory');
    }

    console.log('[boomerang] Handoff complete. Session summary saved.');
  } catch (error) {
    console.error('[boomerang] Handoff failed:', error instanceof Error ? error.message : error);
  }
}

// Export BoomerangPlugin as default for OpenCode
export const BoomerangPlugin = async (ctx: PluginContext): Promise<any> => {
  const config = DEFAULT_CONFIG;
  
  try {
    ctx.client.app?.log?.('Boomerang Protocol v4.0.0 activated');
  } catch {
    // Logging not available
  }

  // Initialize memory system
  try {
    const memorySystem = getMemorySystem();
    await memorySystem.initialize(QDRANT_URL);
    ctx.client.app?.log?.('Super-Memory connected');
  } catch (err) {
    console.error('❌ Failed to initialize memory:', err);
  }

  // Log bundled assets
  console.log(`📦 Loaded ${listAvailableAgents().length} agents`);
  console.log(`📦 Loaded ${listAvailableSkills().length} skills`);

  return {
    tool: {
      boomerang_status: tool({
        description: 'Check Boomerang Protocol status and configuration',
        args: {},
        async execute() {
          return `Boomerang Protocol v${VERSION} Status:
- Memory Enabled: ${config.memoryEnabled}
- Quality Gates: lint=${config.qualityGates.lint}, typecheck=${config.qualityGates.typecheck}, test=${config.qualityGates.test}
- Agents Loaded: ${listAvailableAgents().length}
- Skills Loaded: ${listAvailableSkills().length}`;
        },
      }),

      boomerang_orchestrate: tool({
        description: 'Orchestrate a task - analyze request, query memory, build context package',
        args: {
          prompt: tool.schema.string().describe('The task or request to orchestrate'),
        },
        async execute(args: { prompt: string }) {
          try {
            const orchestrator = createOrchestrator();
            const result = await orchestrator.orchestrate(args.prompt);
            
            return JSON.stringify({
              agent: result.agent,
              systemPrompt: result.systemPrompt,
              contextPackage: result.contextPackage,
              suggestions: result.suggestions,
            }, null, 2);
          } catch (error) {
            return `Orchestration failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      }),

      boomerang_quality_gates: tool({
        description: 'Run quality gates: lint, typecheck, and tests',
        args: {},
        async execute() {
          const result = await runAllQualityGates(DEFAULT_QUALITY_GATES);
          return result.summary;
        },
      }),

      boomerang_memory_search: tool({
        description: 'Search super-memory for relevant context',
        args: {
          query: tool.schema.string().describe('Search query'),
          limit: tool.schema.number().optional().describe('Max results'),
        },
        async execute(args: { query: string; limit?: number }) {
          try {
            const memorySystem = getMemorySystem();
            const results = await memorySystem.search(args.query, { topK: args.limit || 10 });
            
            if (results.length === 0) {
              return 'No relevant memories found.';
            }
            
            return results
              .map(r => `- [${r.score.toFixed(2)}] ${r.entry.text.substring(0, 200)}`)
              .join('\n');
          } catch (error) {
            return `Memory search failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      }),

      boomerang_memory_add: tool({
        description: 'Save context to super-memory',
        args: {
          content: tool.schema.string().describe('Content to save'),
          sourceType: tool.schema.string().optional().describe('Source type (default: manual)'),
        },
        async execute(args: { content: string; sourceType?: string }) {
          try {
            const memorySystem = getMemorySystem();
            const entry = await memorySystem.addMemory({
              text: args.content,
              sourceType: (args.sourceType as any) || 'manual',
              sourcePath: '',
            });
            return `Saved memory (ID: ${entry.id})`;
          } catch (error) {
            return `Failed to save: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      }),
    },

    event: async ({ event }: { event: any }) => {
      const eventType = event.type;
      if (eventType === 'session.created') {
        try {
          ctx.client.app?.log?.('Session created - Boomerang ready');
        } catch {}
      }
      if (eventType === 'session.idle') {
        try {
          ctx.client.app?.log?.('Session idle - Boomerang orchestration available');
        } catch {}
      }
    },

    config: async (cfg: any) => {
      cfg.boomerang = config;
    },

    cleanup: async () => {
      // Cleanup if needed
    },
  };
};

export default BoomerangPlugin;
