// Memory operations hook with caching and debouncing
import { useState, useCallback, useRef } from 'react';
import { getMemoryService } from '../../memory-service.js';

// Types
export interface SearchOptions {
  limit?: number;
  strategy?: 'tiered' | 'vector_only' | 'text_only';
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface ProjectChunk {
  id: string;
  content: string;
  path?: string;
  score?: number;
}

// Cache entry with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const DEBOUNCE_MS = 300; // 300ms

// Memory service interface
interface MemoryServiceClient {
  queryMemories(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchProject(query: string, topK?: number): Promise<ProjectChunk[]>;
  addMemory(entry: { content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }>;
}

// State
let memoryServiceClient: MemoryServiceClient | null = null;

function getMemorySystem(): MemoryServiceClient {
  if (!memoryServiceClient) {
    const service = getMemoryService();
    memoryServiceClient = {
      async queryMemories(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        console.debug('[useMemory] queryMemories:', query);
        const results = await service.queryMemories(query, options);
        // Adapt MemoryEntry[] to SearchResult[] - ensure score is always defined
        return results.map(r => ({
          id: r.id,
          content: r.content,
          score: r.score ?? 0,
          metadata: r.metadata,
        }));
      },
      async searchProject(query: string, topK?: number): Promise<ProjectChunk[]> {
        console.debug('[useMemory] searchProject:', query, topK);
        const results = await service.searchProject(query, topK ?? 20);
        // Adapt ProjectChunk from service to match hook interface (add id if missing)
        return results.map((r, idx) => ({
          id: r.filePath + '-' + idx, // Generate id if not present
          content: r.content,
          path: r.filePath,
          score: r.score,
        }));
      },
      async addMemory(entry: { content: string; metadata?: Record<string, unknown> }): Promise<{ id: string }> {
        console.debug('[useMemory] addMemory:', entry.content.slice(0, 50));
        return service.addMemory({
          content: entry.content,
          sourceType: 'manual',
          metadata: entry.metadata,
        });
      },
    };
  }
  return memoryServiceClient;
}

function setMemorySystem(system: MemoryServiceClient): void {
  memoryServiceClient = system;
}

// Cache map
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// React hook
export function useMemory() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pending queries for debouncing
  const pendingQueries = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Query memories with caching and debouncing
  const queryMemories = useCallback(
    async (query: string, options?: SearchOptions): Promise<SearchResult[]> => {
      const cacheKey = `query:${query}:${JSON.stringify(options || {})}`;

      // Check cache first
      const cached = getCached<SearchResult[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Clear any pending query for this specific query
      const pending = pendingQueries.current.get(query);
      if (pending) {
        clearTimeout(pending);
      }

      return new Promise((resolve) => {
        const timeoutId = setTimeout(async () => {
          setIsLoading(true);
          setError(null);

          try {
            const results = await getMemorySystem().queryMemories(query, options);
            setCache(cacheKey, results);
            resolve(results);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Query failed';
            setError(errorMsg);
            resolve([]);
          } finally {
            setIsLoading(false);
            pendingQueries.current.delete(query);
          }
        }, DEBOUNCE_MS);

        pendingQueries.current.set(query, timeoutId);
      });
    },
    []
  );

  // Search project with caching
  const searchProject = useCallback(
    async (query: string, topK: number = 20): Promise<ProjectChunk[]> => {
      const cacheKey = `project:${query}:${topK}`;

      const cached = getCached<ProjectChunk[]>(cacheKey);
      if (cached) {
        return cached;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await getMemorySystem().searchProject(query, topK);
        setCache(cacheKey, results);
        return results;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Search failed';
        setError(errorMsg);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Add memory
  const addMemory = useCallback(
    async (content: string, metadata?: Record<string, unknown>): Promise<void> => {
      setError(null);

      try {
        await getMemorySystem().addMemory({ content, metadata });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to add memory';
        setError(errorMsg);
        throw err;
      }
    },
    []
  );

  // Clear cache
  const clearCache = useCallback(() => {
    cache.clear();
  }, []);

  return {
    queryMemories,
    searchProject,
    addMemory,
    clearCache,
    isLoading,
    error,
  };
}

// Export for testing
export { setMemorySystem, getCached };
