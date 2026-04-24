/**
 * LanceDB connection wrapper with reference counting
 */

import type { Connection, Table } from '@lancedb/lancedb';
import { connect as lancedbConnect, Index } from '@lancedb/lancedb';

interface PooledConnection {
  /** LanceDB connection instance */
  connection: Connection;
  /** Reference count */
  refCount: number;
  /** Connection URI */
  uri: string;
}

class LanceDBPool {
  private connections: Map<string, PooledConnection> = new Map();

  /**
   * Connect to a LanceDB database with pooling
   */
  async connect(uri: string): Promise<Connection> {
    const existing = this.connections.get(uri);
    if (existing) {
      existing.refCount++;
      return existing.connection;
    }

    const connection = await lancedbConnect(uri);
    this.connections.set(uri, {
      connection,
      refCount: 1,
      uri,
    });

    return connection;
  }

  /**
   * Create a new table with schema
   */
  async createTable(uri: string, name: string, schema: Record<string, unknown>): Promise<Table> {
    const pooled = this.connections.get(uri);
    if (!pooled) {
      throw new Error(`No connection found for URI ${uri}. Call connect() first.`);
    }
    const table = await pooled.connection.createTable(name, [schema]);
    return table;
  }

  /**
   * Get an existing table
   */
  async getTable(uri: string, name: string): Promise<Table> {
    const pooled = this.connections.get(uri);
    if (!pooled) {
      throw new Error(`No connection found for URI ${uri}. Call connect() first.`);
    }
    const table = await pooled.connection.openTable(name);
    return table;
  }

  /**
   * Create an index on a table column
   */
  async createIndex(
    table: Table,
    column: string,
    metric: string = 'cosine'
  ): Promise<void> {
    if (typeof table.createIndex === 'function') {
      // Map metric string to appropriate index config
      const distanceType = metric === 'cosine' ? 'cosine' : metric === 'l2' ? 'l2' : 'dot';
      await table.createIndex(column, {
        config: Index.ivfFlat({ distanceType: distanceType as 'cosine' | 'l2' | 'dot' }),
      });
    }
  }

  /**
   * Close a connection, decrementing ref count
   */
  async close(uri?: string): Promise<void> {
    if (!uri) {
      // Close all connections
      for (const [, pooled] of this.connections) {
        if (typeof pooled.connection.close === 'function') {
          await pooled.connection.close();
        }
      }
      this.connections.clear();
      return;
    }

    const pooled = this.connections.get(uri);
    if (!pooled) return;

    pooled.refCount--;
    if (pooled.refCount <= 0) {
      if (typeof pooled.connection.close === 'function') {
        await pooled.connection.close();
      }
      this.connections.delete(uri);
    }
  }

  /**
   * Get current ref count for a URI
   */
  getRefCount(uri: string): number {
    return this.connections.get(uri)?.refCount ?? 0;
  }
}

export const lancedbPool = new LanceDBPool();
