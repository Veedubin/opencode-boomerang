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
}

export const metricsCollector = new MetricsCollector();