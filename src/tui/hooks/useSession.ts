// Session management hook with memory persistence
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types.js';
import { getMemoryService } from '../../memory-service.js';

// Session interface
export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

// Memory service interface (placeholder for actual implementation)
interface MemoryServiceClient {
  addMemory(entry: { content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }>;
  queryMemories(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  // getMemoriesBySource and deleteMemory are not in MemoryService but we can mock them
}

interface SearchOptions {
  limit?: number;
  strategy?: 'tiered' | 'vector_only' | 'text_only';
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface MemoryEntry {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// State
let sessions: Session[] = [];
let activeSessionId: string | null = null;

// Reset function for testing
export function resetSessions(): void {
  sessions = [];
  activeSessionId = null;
}

// Lazy-loaded memory system reference
let memorySystem: MemoryServiceClient | null = null;

function getMemorySystem(): MemoryServiceClient {
  if (!memorySystem) {
    // Connect to actual memory service
    const service = getMemoryService();
    memorySystem = {
      async addMemory(entry: { content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }> {
        console.debug('[useSession] addMemory called:', entry.content.slice(0, 50));
        return service.addMemory({
          content: entry.content,
          sourceType: 'conversation',
          metadata: entry.metadata,
        });
      },
      async queryMemories(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // Mock implementation - queryMemories returns SearchResult[]
        return service.queryMemories(query, options).then(results =>
          results.map(r => ({
            id: r.id,
            content: r.content,
            score: r.score ?? 0,
            metadata: r.metadata,
          }))
        );
      },
    };
  }
  return memorySystem;
}

function setMemorySystem(system: MemoryServiceClient): void {
  memorySystem = system;
}

// Create new session
export function createSession(name?: string): Session {
  const now = new Date();
  const session: Session = {
    id: uuidv4().slice(0, 8),
    name: name || `Session ${sessions.length + 1}`,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };

  sessions.push(session);
  activeSessionId = session.id;

  // Persist to memory system
  getMemorySystem().addMemory(
    { content: JSON.stringify({ type: 'session', ...session }), metadata: { sourceType: 'session', sessionId: session.id } }
  ).catch(console.error);

  return session;
}

// Switch active session
export function switchSession(sessionId: string): void {
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    activeSessionId = sessionId;
    session.updatedAt = new Date();
  }
}

// List all sessions
export function listSessions(): Session[] {
  return [...sessions];
}

// Delete session
export function deleteSession(sessionId: string): boolean {
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return false;

  sessions.splice(index, 1);

  if (activeSessionId === sessionId) {
    activeSessionId = sessions.length > 0 ? sessions[0].id : null;
  }

  return true;
}

// Get current active session
export function getCurrentSession(): Session | null {
  if (!activeSessionId) return null;
  return sessions.find(s => s.id === activeSessionId) || null;
}

// Update message count for active session
export function incrementMessageCount(): void {
  const session = getCurrentSession();
  if (session) {
    session.messageCount++;
    session.updatedAt = new Date();
  }
}

// Initialize sessions from memory
export async function loadSessionsFromMemory(): Promise<void> {
  try {
    // Query for session entries using the memory service
    const results = await getMemorySystem().queryMemories('session', { limit: 100 });
    sessions = results
      .map(entry => {
        try {
          const data = JSON.parse(entry.content);
          if (data.type === 'session') {
            return {
              id: data.id,
              name: data.name,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
              messageCount: data.messageCount || 0,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter((s): s is Session => s !== null);

    if (sessions.length > 0) {
      activeSessionId = sessions[0].id;
    }
  } catch (error) {
    console.error('[useSession] Failed to load sessions from memory:', error);
  }
}

// React hook wrapper
export function useSession() {
  return {
    createSession,
    switchSession,
    listSessions,
    deleteSession,
    getCurrentSession,
    incrementMessageCount,
    loadSessionsFromMemory,
  };
}

// Export for testing
export { setMemorySystem };
