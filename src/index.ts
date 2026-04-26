// OpenCode plugin interface
export const PLUGIN_NAME = '@boomerang/opencode-plugin';
export const VERSION = '2.2.0';

// Plugin interface types
export interface PluginRegistry {
  registerCommand(name: string, handler: CommandHandler): void;
  registerAgent(name: string, definition: AgentDefinition): void;
  registerSkill(name: string, definition: SkillDefinition): void;
}

export interface PluginContext {
  args: string[];
  cwd: string;
  interactive: boolean;
}

export interface CommandHandler {
  (context: PluginContext): Promise<void>;
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

import { loadAgents, loadSkills, getAgent, getSkill } from './asset-loader.js';
import { MemoryService, getMemoryService } from './memory-service.js';
import { spawn } from 'child_process';

let memoryService: MemoryService | null = null;

/**
 * Register the plugin with the OpenCode registry
 */
export function register(registry: PluginRegistry): void {
  // Load agents and skills
  const agents = loadAgents();
  const skills = loadSkills();

  // Register each agent
  for (const agent of agents) {
    registry.registerAgent(agent.name, agent);
  }

  // Register each skill
  for (const skill of skills) {
    registry.registerSkill(skill.name, skill);
  }

  // Register commands
  registry.registerCommand('boomerang', handleBoomerangCommand);
  registry.registerCommand('chat', handleChatCommand);
  registry.registerCommand('index', handleIndexCommand);
  registry.registerCommand('install-agents', handleInstallAgentsCommand);
}

/**
 * Main execution loop for the plugin
 */
export async function execute(context: PluginContext): Promise<void> {
  const [command, ...args] = context.args;

  // Initialize memory system
  memoryService = getMemoryService();
  try {
    await memoryService.initialize();
    if (memoryService.isFallbackMode()) {
      console.log('⚠️ Memory system in fallback mode — operating without persistence');
    } else {
      console.log('✅ Memory system initialized');
    }
  } catch (err) {
    console.error('❌ Failed to initialize memory:', err);
  }

  try {
    if (context.interactive) {
      // Start TUI for interactive mode
      await startTUI(context);
    } else {
      // Handle CLI commands
      switch (command) {
        case 'boomerang':
          await handleBoomerangCommand(context);
          break;
        case 'chat':
          await handleChatCommand(context);
          break;
        case 'index':
          await handleIndexCommand(context);
          break;
        case 'install-agents':
          await handleInstallAgentsCommand(context);
          break;
        default:
          console.log('Available commands: boomerang, chat, index, install-agents');
      }
    }
  } finally {
    memoryService = null;
  }
}

/**
 * Handle boomerang command - main agent interaction
 */
async function handleBoomerangCommand(context: PluginContext): Promise<void> {
  const agentName = context.args[0] || 'boomerang';
  const agent = getAgent(agentName);

  if (!agent) {
    console.error(`Agent not found: ${agentName}`);
    return;
  }

  console.log(`Starting Boomerang agent: ${agent.name}`);
  console.log(`Description: ${agent.description}`);

  // The actual agent execution would happen here
  // For now, just display the agent info
  console.log('\nSystem prompt loaded.');
}

/**
 * Handle chat command - interactive conversation
 */
async function handleChatCommand(context: PluginContext): Promise<void> {
  console.log('Starting interactive chat mode...');

  if (!memoryService) {
    console.error('Memory service not initialized');
    return;
  }

  // Query memories if provided
  if (context.args.length > 0) {
    const query = context.args.join(' ');
    console.log(`Searching memories for: ${query}`);
    const results = await memoryService.queryMemories(query, {});
    console.log(`Found ${results.length} memories`);
  } else {
    console.log('Chat mode ready. Type your queries.');
  }
}

/**
 * Handle index command - index project files
 */
async function handleIndexCommand(context: PluginContext): Promise<void> {
  console.log('Indexing project...');

  if (!memoryService) {
    console.error('Memory service not initialized');
    return;
  }

  const path = context.args[0] || context.cwd;
  console.log(`Indexing path: ${path}`);

  await memoryService.indexProject(path);
  console.log('Project indexed successfully');
}

/**
 * Handle install-agents command - run the agent installation script
 */
async function handleInstallAgentsCommand(_context: PluginContext): Promise<void> {
  console.log('Running agent installation...');
  
  const scriptPath = new URL('../scripts/install-agents.js', import.meta.url);
  const child = spawn('node', [scriptPath.pathname], {
    stdio: 'inherit',
    shell: false
  });
  
  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`Script exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

/**
 * Start the TUI for interactive mode
 */
async function startTUI(context: PluginContext): Promise<void> {
  // Import TUI app dynamically - it's a React Ink component
  const { App } = await import('./tui/index.jsx');
  console.log('Starting TUI...', { context, hasApp: !!App });
  // Note: Full TUI integration would render the App component here
  // For now, just indicate TUI mode
}

// Re-export for external use
export { loadAgents, loadSkills, getAgent, getSkill } from './asset-loader.js';
export { MemoryService, getMemoryService } from './memory-service.js';
