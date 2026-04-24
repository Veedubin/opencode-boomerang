// Session management hook with memory persistence
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types.js';

// Session interface
export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

// Memory system interface (placeholder for actual implementation)
interface MemorySystem {
  addMemory(content: string, metadata?: Record<string, unknown>): Promise<void>;
  queryMemories(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getMemoriesBySource(sourceType: string): Promise<MemoryEntry[]>;
  deleteMemory(id: string): Promise<boolean>;
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
let memorySystem: MemorySystem | null = null;

function getMemorySystem(): MemorySystem {
  if (!memorySystem) {
    // Placeholder - in real implementation this would connect to actual memory system
    memorySystem = {
      async addMemory(content: string, metadata?: Record<string, unknown>): Promise<void> {
        // Mock implementation
        console.debug('[useSession] addMemory called:', content.slice(0, 50));
      },
      async queryMemories(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // Mock implementation
        return [];
      },
      async getMemoriesBySource(sourceType: string): Promise<MemoryEntry[]> {
        // Mock implementation
        return [];
      },
      async deleteMemory(id: string): Promise<boolean> {
        // Mock implementation
        return true;
      },
    };
  }
  return memorySystem;
}

function setMemorySystem(system: MemorySystem): void {
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
    JSON.stringify({ type: 'session', ...session }),
    { sourceType: 'session', sessionId: session.id }
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
    const memoryEntries = await getMemorySystem().getMemoriesBySource('session');
    sessions = memoryEntries
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
