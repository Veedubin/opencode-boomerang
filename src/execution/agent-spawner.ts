/**
 * Agent Spawner - Spawns agent subprocesses for real execution
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export interface SpawnOptions {
  timeoutMs?: number;
  maxOutputLength?: number;
  env?: Record<string, string>;
  workingDirectory?: string;
}

export interface AgentProcess {
  id: string;
  pid: number;
  agentName: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
  output: string;
  exitCode?: number;
  startTime: number;
  endTime?: number;
  kill(): void;
}

export interface SpawnerConfig {
  maxConcurrentAgents: number;
  defaultTimeoutMs: number;
  maxOutputLength: number;
  nodePath?: string;
}

const DEFAULT_CONFIG: SpawnerConfig = {
  maxConcurrentAgents: 5,
  defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes
  maxOutputLength: 100 * 1024, // 100KB
  nodePath: process.execPath,
};

export class AgentSpawner {
  private activeProcesses: Map<string, AgentProcess> = new Map();
  private config: SpawnerConfig;

  constructor(config: Partial<SpawnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Spawn an agent subprocess
   */
  async spawn(
    agentName: string,
    prompt: string,
    options: SpawnOptions = {}
  ): Promise<AgentProcess> {
    // Check concurrency limit
    if (this.activeProcesses.size >= this.config.maxConcurrentAgents) {
      throw new Error(`Max concurrent agents (${this.config.maxConcurrentAgents}) reached`);
    }

    const processId = this.generateProcessId();
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const maxOutputLength = options.maxOutputLength ?? this.config.maxOutputLength;

    // Create execution script
    const scriptPath = await this.createExecutionScript(agentName, prompt, processId);
    
    // Spawn the process
    const childProcess = spawn(this.config.nodePath!, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
      cwd: options.workingDirectory ?? process.cwd(),
      detached: false,
    });

    // Create agent process tracking object
    const agentProcess: AgentProcess = {
      id: processId,
      pid: childProcess.pid!,
      agentName,
      status: 'running',
      output: '',
      startTime: Date.now(),
      kill: () => {
        try {
          process.kill(childProcess.pid!, 'SIGTERM');
        } catch {
          // Process may already be dead
        }
        this.activeProcesses.delete(processId);
        agentProcess.status = 'killed';
        agentProcess.endTime = Date.now();
      },
    };

    this.activeProcesses.set(processId, agentProcess);

    // Set up output collection with mutable reference
    const output = { buffer: '' };
    
    childProcess.stdout?.on('data', (data: Buffer) => {
      output.buffer += data.toString();
      if (output.buffer.length > maxOutputLength) {
        childProcess.kill('SIGTERM');
      }
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      output.buffer += data.toString();
    });

    // Monitor the process - pass output object for mutation
    this.monitorProcess(childProcess, processId, timeoutMs, agentProcess, output, scriptPath);

    return agentProcess;
  }

  /**
   * Kill a specific process
   */
  kill(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    if (!process) return false;
    
    process.kill();
    return true;
  }

  /**
   * Kill all active processes
   */
  killAll(): void {
    for (const [id] of this.activeProcesses) {
      this.kill(id);
    }
  }

  /**
   * List all active processes
   */
  listActive(): AgentProcess[] {
    return Array.from(this.activeProcesses.values());
  }

  /**
   * Get a specific process by ID
   */
  getProcess(processId: string): AgentProcess | undefined {
    return this.activeProcesses.get(processId);
  }

  /**
   * Create a temporary execution script
   */
  private async createExecutionScript(
    agentName: string,
    prompt: string,
    processId: string
  ): Promise<string> {
    const script = this.buildExecutionScript(agentName, prompt, processId);
    
    // Create temp file
    const tmpDir = await mkdtemp(join(tmpdir(), 'boomerang-agent-'));
    const scriptPath = join(tmpDir, `agent-${processId}.js`);

    await writeFile(scriptPath, script, 'utf-8');

    // Schedule cleanup of temp script after execution
    setTimeout(async () => {
      try {
        await unlink(scriptPath).catch(() => {});
      } catch {
        // Ignore cleanup errors
      }
    }, 30000); // Give 30 seconds for process to complete before cleanup

    return scriptPath;
  }

  /**
   * Build the execution script content
   */
  private buildExecutionScript(agentName: string, prompt: string, processId: string): string {
    // Escape the prompt for embedding in JS string
    const escapedPrompt = prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    // The execution script:
    // 1. Simulates agent execution (in real implementation would call LLM API)
    // 2. Returns structured JSON output
    // 3. Handles errors gracefully
    return `
// Boomerang Agent Execution Script
// Agent: ${agentName}
// Process ID: ${processId}

const AgentRunner = {
  async execute(agentName, prompt) {
    try {
      // In production, this would:
      // 1. Load agent configuration (model, system prompt)
      // 2. Call LLM API with the prompt
      // 3. Return the response

      // For now, simulate agent execution
      const startTime = Date.now();
      
      // Simulate some work based on prompt complexity
      const complexity = Math.min(prompt.length / 100, 5);
      await new Promise(resolve => setTimeout(resolve, complexity * 100));

      // Simulated output based on agent type
      let result = '';
      
      // Map agent names to their typical outputs
      const agentOutputs = {
        'boomerang-coder': '[CODER] Implemented task: ' + prompt.substring(0, 100) + '...',
        'boomerang-explorer': '[EXPLORER] Found relevant files for task',
        'boomerang-tester': '[TESTER] Created/updated test files',
        'boomerang-linter': '[LINTER] Code quality check complete',
        'boomerang-git': '[GIT] Operation completed successfully',
        'boomerang-writer': '[WRITER] Documentation updated',
        'boomerang-architect': '[ARCHITECT] Design analysis complete',
        'boomerang-scraper': '[SCRAPER] Research data collected',
        'researcher': '[RESEARCHER] Information gathered',
        'mcp-specialist': '[MCP] Tool/server work completed',
      };

      result = agentOutputs[agentName] || "[GENERIC] Executed: " + prompt.substring(0, 80) + "...";

      const duration = Date.now() - startTime;

      return {
        success: true,
        result: result,
        duration: duration,
        agent: agentName,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        result: '',
      };
    }
  }
};

// Main execution
(async () => {
  try {
    const result = await AgentRunner.execute("${agentName}", "${escapedPrompt}");
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const errorResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown fatal error',
      result: '',
    };
    console.error(JSON.stringify(errorResult));
    process.exit(1);
  }
})();
`;
  }

  /**
   * Monitor a child process for completion
   */
  private async monitorProcess(
    childProcess: ChildProcess,
    processId: string,
    timeoutMs: number,
    agentProcess: AgentProcess,
    output: { buffer: string },
    scriptPath: string
  ): Promise<void> {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      agentProcess.kill();
      agentProcess.status = 'timeout';
    }, timeoutMs);

    // Wait for process to exit
    return new Promise((resolve) => {
      childProcess.on('close', (exitCode: number | null) => {
        clearTimeout(timeoutId);
        
        // Clean up temp script
        unlink(scriptPath).catch(() => {});

        // Update agent process state
        agentProcess.output = output.buffer;
        agentProcess.exitCode = exitCode ?? undefined;
        agentProcess.endTime = Date.now();

        if (agentProcess.status === 'running') {
          if (exitCode === 0) {
            agentProcess.status = 'completed';
          } else if (exitCode !== null) {
            agentProcess.status = 'failed';
          }
        }

        // Remove from active processes
        this.activeProcesses.delete(processId);

        resolve();
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        agentProcess.output += "\\nError: " + error.message;
        agentProcess.status = 'failed';
        agentProcess.endTime = Date.now();
        this.activeProcesses.delete(processId);
      });
    });
  }

  /**
   * Generate a unique process ID
   */
  private generateProcessId(): string {
    return `agent-${Date.now()}-${randomUUID().substring(0, 8)}`;
  }
}