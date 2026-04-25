import { metricsCollector } from '../metrics/collector.js';

export interface AgentScore {
  agent: string;
  score: number;
  factors: { successRate: number; avgLatency: number; sampleCount: number };
}

export interface RoutingPreferences {
  optimizeFor: 'speed' | 'quality' | 'balanced';
}

export class ScoringRouter {
  private minSamples = 5;

  async selectAgent(taskType: string, preferences: RoutingPreferences = { optimizeFor: 'balanced' }): Promise<AgentScore> {
    const candidates = this.getCandidateAgents(taskType);
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events = await metricsCollector.query({ since, type: 'task.completed' });

    const scores = await Promise.all(candidates.map(async (agent) => {
      const agentEvents = events.filter(e => e.data.agent === agent && e.data.taskType === taskType);
      const successEvents = agentEvents.filter(e => e.data.success === true);
      const sampleCount = agentEvents.length;
      const successRate = sampleCount > 0 ? successEvents.length / sampleCount : 0.5;
      const avgLatency = sampleCount > 0 ? agentEvents.reduce((sum, e) => sum + (e.data.duration as number), 0) / sampleCount : 5000;

      let score: number;
      switch (preferences.optimizeFor) {
        case 'speed': score = (successRate * 0.3) + ((1 / (1 + avgLatency / 1000)) * 0.7); break;
        case 'quality': score = (successRate * 0.8) + ((1 / (1 + avgLatency / 1000)) * 0.2); break;
        default: score = (successRate * 0.5) + ((1 / (1 + avgLatency / 1000)) * 0.5);
      }
      if (sampleCount < this.minSamples) score *= 0.8;

      return { agent, score, factors: { successRate, avgLatency, sampleCount } };
    }));

    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0 || scores[0].factors.sampleCount < this.minSamples) {
      return { agent: this.keywordFallback(taskType), score: 0.5, factors: { successRate: 0.5, avgLatency: 5000, sampleCount: 0 } };
    }
    return scores[0];
  }

  private getCandidateAgents(taskType: string): string[] {
    const map: Record<string, string[]> = {
      explore: ['boomerang-explorer', 'boomerang-coder'],
      write: ['boomerang-writer', 'boomerang-coder'],
      test: ['boomerang-tester', 'boomerang-coder'],
      review: ['boomerang-architect', 'boomerang-coder'],
      git: ['boomerang-git', 'boomerang-coder'],
      code: ['boomerang-coder', 'boomerang-explorer'],
      general: ['boomerang'],
    };
    return map[taskType] || ['boomerang'];
  }

  private keywordFallback(taskType: string): string {
    const map: Record<string, string> = {
      explore: 'boomerang-explorer', write: 'boomerang-writer',
      test: 'boomerang-tester', review: 'boomerang-architect',
      git: 'boomerang-git', code: 'boomerang-coder', general: 'boomerang',
    };
    return map[taskType] || 'boomerang';
  }
}

export const scoringRouter = new ScoringRouter();