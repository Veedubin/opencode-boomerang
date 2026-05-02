import { contextMonitor } from './monitor.js';
import { getMemoryService } from '../memory-service.js';
import type { SessionData } from '../protocol/types.js';

export interface CompactionResult {
  success: boolean;
  summary: string;
  savedContext: string;
}

export class ContextCompactor {
  async compact(sessionId: string): Promise<CompactionResult> {
    try {
      const memoryService = getMemoryService();
      // Session data now tracked via ProtocolStateMachine
      const summary = this.generateSummary(sessionId);

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

  private generateSummary(sessionId: string): string {
    // In ProtocolStateMachine, checkpoints are stored differently
    // For compaction summary, we track that compaction occurred
    return `Session ${sessionId} compacted at ${new Date().toISOString()}`;
  }
}

export const contextCompactor = new ContextCompactor();