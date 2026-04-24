/**
 * LanceDB connection pool tests with mocked dependencies
 */

import { test, expect, describe, beforeEach, vi } from 'vitest';
import type { Connection, Table } from '@lancedb/lancedb';

// Use vi.hoisted for proper hoisting
const { mockConnection, mockTable, mockConnect } = vi.hoisted(() => {
  const mockTable = {
    createIndex: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockReturnValue({
      nearest: vi.fn().mockReturnThis(),
      nearestTo: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    createTable: vi.fn().mockResolvedValue(mockTable),
    openTable: vi.fn().mockResolvedValue(mockTable),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnect = vi.fn().mockResolvedValue(mockConnection);

  return { mockConnection, mockTable, mockConnect };
});

// Mock lancedb module
vi.mock('@lancedb/lancedb', () => ({
  connect: mockConnect,
  Index: {
    ivfFlat: vi.fn().mockReturnValue({}),
  },
}));

// Import after mocks
import { lancedbPool } from '../../src/memory/database';

describe('LanceDBPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    test('creates new connection when URI not in pool', async () => {
      const uri = 'memory://test-new';
      const connection = await lancedbPool.connect(uri);

      expect(connection).toBeDefined();
      expect(mockConnect).toHaveBeenCalledWith(uri);
    });

    test('reuses existing connection when URI already connected', async () => {
      const uri = 'memory://test-reuse';

      // First connection
      await lancedbPool.connect(uri);
      const callCountAfterFirst = mockConnect.mock.calls.length;

      // Second connection to same URI
      await lancedbPool.connect(uri);

      // Should not call connect again
      expect(mockConnect.mock.calls.length).toBe(callCountAfterFirst);
    });

    test('increments ref count on reused connection', async () => {
      const uri = 'memory://test-refcount';

      await lancedbPool.connect(uri);
      await lancedbPool.connect(uri);
      await lancedbPool.connect(uri);

      const refCount = lancedbPool.getRefCount(uri);
      expect(refCount).toBe(3);
    });
  });

  describe('createTable', () => {
    test('creates table on connected database', async () => {
      const uri = 'memory://test-createtable';
      const tableName = 'test_table';
      const schema = { id: 'string', text: 'string' };

      await lancedbPool.connect(uri);
      const table = await lancedbPool.createTable(uri, tableName, schema);

      expect(table).toBeDefined();
      expect(mockConnect).toHaveBeenCalledWith(uri);
    });

    test('throws error when no connection found', async () => {
      const uri = 'memory://nonexistent';
      const tableName = 'orphan_table';
      const schema = { id: 'string' };

      await expect(lancedbPool.createTable(uri, tableName, schema)).rejects.toThrow(
        /No connection found/
      );
    });
  });

  describe('getTable', () => {
    test('opens existing table', async () => {
      const uri = 'memory://test-gettable';
      const tableName = 'existing_table';

      await lancedbPool.connect(uri);
      const table = await lancedbPool.getTable(uri, tableName);

      expect(table).toBeDefined();
    });

    test('throws error when no connection found', async () => {
      const uri = 'memory://nonexistent';
      const tableName = 'orphan_table';

      await expect(lancedbPool.getTable(uri, tableName)).rejects.toThrow(
        /No connection found/
      );
    });
  });

  describe('createIndex', () => {
    test('creates index on table column with cosine metric', async () => {
      const table = mockTable as unknown as Table;

      await lancedbPool.createIndex(table, 'vector', 'cosine');

      expect(mockTable.createIndex).toHaveBeenCalledWith('vector', {
        config: expect.objectContaining({}),
      });
    });

    test('creates index with l2 metric', async () => {
      const table = mockTable as unknown as Table;

      await lancedbPool.createIndex(table, 'vector', 'l2');

      expect(mockTable.createIndex).toHaveBeenCalled();
    });

    test('creates index with dot metric', async () => {
      const table = mockTable as unknown as Table;

      await lancedbPool.createIndex(table, 'vector', 'dot');

      expect(mockTable.createIndex).toHaveBeenCalled();
    });

    test('handles table without createIndex method gracefully', async () => {
      const tableWithoutIndex = {
        query: vi.fn(),
      } as unknown as Table;

      // Should not throw
      await expect(
        lancedbPool.createIndex(tableWithoutIndex, 'vector', 'cosine')
      ).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    test('closes specific connection and decrements ref count', async () => {
      const uri = 'memory://test-close-specific';

      await lancedbPool.connect(uri);
      await lancedbPool.connect(uri);

      let refCount = lancedbPool.getRefCount(uri);
      expect(refCount).toBe(2);

      // Close once
      await lancedbPool.close(uri);
      refCount = lancedbPool.getRefCount(uri);
      expect(refCount).toBe(1);

      // Close again
      await lancedbPool.close(uri);
      refCount = lancedbPool.getRefCount(uri);
      expect(refCount).toBe(0);
    });

    test('closes all connections when no URI provided', async () => {
      await lancedbPool.connect('memory://close-all-1');
      await lancedbPool.connect('memory://close-all-2');

      await lancedbPool.close();

      // After close all, both should be removed
      expect(lancedbPool.getRefCount('memory://close-all-1')).toBe(0);
      expect(lancedbPool.getRefCount('memory://close-all-2')).toBe(0);
    });

    test('close non-existent URI is safe', async () => {
      await expect(lancedbPool.close('memory://nonexistent')).resolves.not.toThrow();
    });

    test('ref count does not go negative', async () => {
      const uri = 'memory://test-negative-ref';

      await lancedbPool.connect(uri);
      await lancedbPool.close(uri);
      await lancedbPool.close(uri); // Second close should not go negative

      expect(lancedbPool.getRefCount(uri)).toBe(0);
    });
  });

  describe('getRefCount', () => {
    test('returns 0 for non-existent URI', () => {
      const refCount = lancedbPool.getRefCount('memory://doesnotexist');
      expect(refCount).toBe(0);
    });

    test('returns correct ref count after multiple connects', async () => {
      const uri = 'memory://test-getref';

      await lancedbPool.connect(uri);
      await lancedbPool.connect(uri);
      await lancedbPool.connect(uri);

      expect(lancedbPool.getRefCount(uri)).toBe(3);
    });
  });
});
