/**
 * Shared infrastructure types for use-case modules.
 *
 * Use cases depend on this minimal interface rather than the concrete db.ts
 * Pool/PoolClient classes so they remain easy to unit-test with fakes.
 */

import type { QueryResult } from '../lib/db.js';

/** Anything that can run a read-only (autocommit) SQL query. */
export type Queryable = {
  query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
};

/** A pool client that additionally supports connect() for transactions. */
export type TransactionPool = Queryable & {
  connect(): Promise<TransactionClient>;
};

/** A checked-out connection that supports explicit BEGIN/COMMIT/ROLLBACK. */
export type TransactionClient = Queryable & {
  release(): void;
};
