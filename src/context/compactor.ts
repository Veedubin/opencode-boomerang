import { contextMonitor } from './monitor.js';
import { getMemoryService } from '../memory-service.js';
import { protocolTracker } from '../protocol/tracker.js';

export interface CompactionResult {
  success: boolean;
  summary: string;
  savedContext: string;
}

export class ContextCompactor {
  async compact(sessionId: string): Promise<CompactionResult> {
    try {
      const memoryService = getMemoryService();
      const session = protocolTracker.getOrCreateSession(sessionId);
      const summary = this.generateSummary(session);

      await memoryService.addMemory({
        content: `Session compaction: ${summary}`,
        sourceType: 'conversation',
        sessionId,
        metadata: { type: 'compaction', timestamp: Date.now() },
      });

      contextMonitor.reset();

      return { success: true, summary, savedContext: sessionId };
    } catch (error) {
      return {
        success: false,
        summary: '',
        savedContext: error instanceof Error ? error.message : 'Compaction failed',
      };
    }
  }

  private generateSummary(session: any): string {
    const toolCalls = session.toolCalls;
    const uniqueTools = [...new Set(toolCalls.map((t: any) => t.toolName))];
    const duration = Date.now() - session.startTime;
    return `Tools: ${uniqueTools.join(', ')}; Calls: ${toolCalls.length}; Duration: ${Math.round(duration / 1000)}s`;
  }
}

export const contextCompactor = new ContextCompactor();