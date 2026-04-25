export interface ContextThreshold {
  percent: number;
  action: 'warn' | 'compact' | 'handoff';
  callback?: () => void | Promise<void>;
}

export class ContextMonitor {
  private currentTokens = 0;
  private maxTokens: number;
  private thresholds: ContextThreshold[] = [];
  private triggeredThresholds = new Set<number>();

  constructor(maxTokens: number = 128000) {
    this.maxTokens = maxTokens;
    this.thresholds = [
      { percent: 40, action: 'compact' },
      { percent: 80, action: 'handoff' },
    ];
  }

  updateUsage(tokensUsed: number): void {
    this.currentTokens = tokensUsed;
    this.checkThresholds();
  }

  estimateUsage(text: string): void {
    // Rough estimate: 1 token ≈ 4 characters for English text
    // For mixed content (code, markdown), use 3.5 chars/token
    const ratio = text.includes('```') || text.includes('function') || text.includes('class') ? 3.5 : 4.0;
    this.currentTokens += Math.ceil(text.length / ratio);
    this.checkThresholds();
  }

  estimateUsageBatch(texts: string[]): void {
    for (const text of texts) {
      this.estimateUsage(text);
    }
  }

  getUsagePercent(): number {
    return (this.currentTokens / this.maxTokens) * 100;
  }

  onThreshold(percent: number, action: ContextThreshold['action'], callback?: () => void | Promise<void>): void {
    this.thresholds.push({ percent, action, callback });
    this.thresholds.sort((a, b) => a.percent - b.percent);
  }

  reset(): void {
    this.triggeredThresholds.clear();
    this.currentTokens = 0;
  }

  private checkThresholds(): void {
    const currentPercent = this.getUsagePercent();
    for (const threshold of this.thresholds) {
      if (currentPercent >= threshold.percent && !this.triggeredThresholds.has(threshold.percent)) {
        this.triggeredThresholds.add(threshold.percent);
        this.executeAction(threshold);
      }
    }
  }

  private async executeAction(threshold: ContextThreshold): Promise<void> {
    console.warn(`[ContextMonitor] ${threshold.action} at ${threshold.percent}%`);
    if (threshold.callback) {
      await threshold.callback();
    }
  }
}

export const contextMonitor = new ContextMonitor();