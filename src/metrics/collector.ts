import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export type MetricsEventType = 
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'memory.queried'
  | 'memory.saved'
  | 'routing.decision'
  | 'context.compaction'
  | 'protocol.violation';

export interface MetricsEvent {
  type: MetricsEventType;
  timestamp: number;
  sessionId: string;
  data: Record<string, unknown>;
}

export interface AgentMetrics {
  agentId: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  avgDuration: number;
}

export class MetricsCollector {
  private buffer: MetricsEvent[] = [];
  private flushIntervalMs = 5000;
  private bufferSize = 100;
  private storagePath: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(storagePath = '.opencode/boomerang-metrics.jsonl') {
    this.storagePath = storagePath;
    this.startFlushTimer();
  }

  emit(event: Omit<MetricsEvent, 'timestamp'>): void {
    const fullEvent: MetricsEvent = { ...event, timestamp: Date.now() };
    this.buffer.push(fullEvent);
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) this.flush();
    }, this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];
    try {
      await mkdir(dirname(this.storagePath), { recursive: true });
      const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await appendFile(this.storagePath, lines);
    } catch (error) {
      console.error('Metrics flush failed:', error);
      this.buffer.unshift(...events);
    }
  }

  async query(options: {
    since?: number;
    type?: MetricsEventType;
    sessionId?: string;
    limit?: number;
  } = {}): Promise<MetricsEvent[]> {
    const { readFile } = await import('fs/promises');
    try {
      const content = await readFile(this.storagePath, 'utf-8');
      const events = content.split('\n').filter(Boolean).map(line => JSON.parse(line) as MetricsEvent);
      return events
        .filter(e => !options.since || e.timestamp >= options.since)
        .filter(e => !options.type || e.type === options.type)
        .filter(e => !options.sessionId || e.sessionId === options.sessionId)
        .slice(-(options.limit ?? 1000));
    } catch {
      return [];
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async getAgentMetrics(since?: number): Promise<AgentMetrics[]> {
    const events = await this.query({ since, limit: 10000 });
    const agentMap = new Map<string, AgentMetrics>();

    for (const event of events) {
      if (event.type === 'task.completed' || event.type === 'task.failed') {
        const agentId = (event.data.agent as string) || 'unknown';
        const success = event.type === 'task.completed';
        const duration = (event.data.duration as number) || 0;

        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, { agentId, totalTasks: 0, successfulTasks: 0, failedTasks: 0, avgDuration: 0 });
        }

        const metrics = agentMap.get(agentId)!;
        metrics.totalTasks++;
        if (success) metrics.successfulTasks++;
        else metrics.failedTasks++;
        metrics.avgDuration = (metrics.avgDuration * (metrics.totalTasks - 1) + duration) / metrics.totalTasks;
      }
    }

    return Array.from(agentMap.values());
  }

  async getRoutingDecisions(since?: number, limit = 20): Promise<{ timestamp: number; taskType: string; agent: string; method: string }[]> {
    const events = await this.query({ since, type: 'routing.decision', limit });
    return events.map(e => ({
      timestamp: e.timestamp,
      taskType: e.data.taskType as string,
      agent: e.data.agent as string,
      method: e.data.method as string,
    }));
  }
}

export const metricsCollector = new MetricsCollector();