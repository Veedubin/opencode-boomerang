import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MemoryEngine {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private memoryDataDir: string;

  constructor() {
    this.memoryDataDir = process.env.BOOMERANG_MEMORY_DIR || path.join(
      os.homedir(), '.local/share/opencode-boomerang/memory'
    );
  }

  async start(): Promise<void> {
    if (this.process) return;
    fs.mkdirSync(this.memoryDataDir, { recursive: true });

    const pythonPath = await this.findPython();
    const superMemoryDir = path.join(__dirname, '..', 'super-memory');

    this.process = spawn(pythonPath, ['-m', 'super_memory'], {
      cwd: superMemoryDir,
      env: { ...process.env, MEMORY_DATA_DIR: this.memoryDataDir, PYTHONPATH: path.join(superMemoryDir, 'src') },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout?.on('data', (data: Buffer) => this.handleResponse(data.toString()));
    this.process.stderr?.on('data', (data: Buffer) => console.log(`[super-memory] ${data.toString().trim()}`));
    this.process.on('exit', (_code) => { this.process = null; });

    await this.waitForReady();
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.process.kill('SIGTERM');
    setTimeout(() => this.process?.kill('SIGKILL'), 5000);
  }

  async call(method: string, params?: any): Promise<any> {
    if (!this.process?.stdin) throw new Error('Memory engine not started');
    const id = ++this.requestId;
    const request = { jsonrpc: '2.0', method, params, id };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + '\n');
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} timed out`));
        }
      }, 30000);
    });
  }

  private handleResponse(data: string): void {
    try {
      const lines = data.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const response = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          response.error ? pending.reject(new Error(response.error.message)) : pending.resolve(response.result);
        }
      }
    } catch (err) { console.error('Failed to parse memory response:', err); }
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 2000));
  }

  private async findPython(): Promise<string> {
    const candidates = ['python3.13', 'python3.12', 'python3.11', 'python3', 'python'];
    for (const cmd of candidates) {
      try {
        await new Promise<string>((resolve, reject) => {
          const proc = spawn(cmd, ['--version']);
          proc.on('exit', (code) => code === 0 ? resolve(cmd) : reject());
        });
        return cmd;
      } catch { continue; }
    }
    throw new Error('Python 3.11+ not found');
  }
}

export const memoryEngine = new MemoryEngine();