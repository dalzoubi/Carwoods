/**
 * Azure SQL (mssql / tedious) wrapper that exposes the same surface as the
 * previous pg Pool so callers need minimal changes:
 *
 *   pool.query(sql, params?)          → QueryResult<T>
 *   pool.connect()                    → PoolClient
 *   client.query(sql, params?)        → QueryResult<T> (autocommit unless BEGIN is active)
 *   client.query('BEGIN'/'COMMIT'/'ROLLBACK')
 *   client.release()
 *
 * DATABASE_URL must be in MSSQL ADO.NET format (set by Bicep):
 *   Server=<host>,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=yes;TrustServerCertificate=no
 *
 * SQL dialect notes for callers:
 *   - Use $1, $2, … for positional parameters (converted to @p1, @p2 here)
 *   - Cast hints like $1::uuid or $1::jsonb are stripped automatically
 *   - Use T-SQL syntax for everything else (OUTPUT INSERTED.*, MERGE, etc.)
 *   - Use GETUTCDATE() / SYSDATETIMEOFFSET() instead of now()
 *   - Use NEWID() instead of gen_random_uuid()
 */

import mssql from 'mssql';

// ---------------------------------------------------------------------------
// Connection-string parser
// ---------------------------------------------------------------------------

function parseConnectionString(cs: string): mssql.config {
  const parts: Record<string, string> = {};
  for (const segment of cs.split(';')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    parts[segment.slice(0, eq).trim().toLowerCase()] = segment.slice(eq + 1).trim();
  }
  const server = parts['server'] ?? '';
  const [host, portStr] = server.includes(',') ? server.split(',') : [server, '1433'];
  return {
    server: host,
    port: parseInt(portStr ?? '1433', 10),
    database: parts['database'] ?? parts['initial catalog'] ?? '',
    user: parts['user id'] ?? parts['uid'] ?? '',
    password: parts['password'] ?? parts['pwd'] ?? '',
    options: {
      encrypt: (parts['encrypt'] ?? 'yes').toLowerCase() !== 'no',
      trustServerCertificate: (parts['trustservercertificate'] ?? 'no').toLowerCase() === 'yes',
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
  };
}

// ---------------------------------------------------------------------------
// Shared query result shape (mirrors pg.QueryResult)
// ---------------------------------------------------------------------------

export type QueryResult<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number | null;
};

// ---------------------------------------------------------------------------
// Column names whose string values should be parsed as JSON
// ---------------------------------------------------------------------------

const JSON_COLUMNS = new Set([
  'metadata', 'before_json', 'after_json', 'payload', 'additional_recipients',
]);

// ---------------------------------------------------------------------------
// Row post-processor
// ---------------------------------------------------------------------------

function normaliseRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && JSON_COLUMNS.has(k)) {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function normaliseRows<T>(recordset: mssql.IRecordSet<T> | undefined): T[] {
  if (!recordset) return [];
  return (recordset as unknown as Record<string, unknown>[]).map((r) => normaliseRow<T>(r));
}

// ---------------------------------------------------------------------------
// Parameter conversion: $1/$2 → @p1/@p2, strip ::cast hints
// ---------------------------------------------------------------------------

function buildRequest(
  base: mssql.Request,
  sql: string,
  values: unknown[] | undefined
): { sql: string; request: mssql.Request } {
  let converted = sql;

  if (values && values.length > 0) {
    // Strip cast hints first so they don't interfere with plain substitution
    converted = converted.replace(/\$(\d+)::\w+/g, (_m, n) => `@p${n}`);
    // Replace remaining plain $N
    converted = converted.replace(/\$(\d+)/g, (_m, n) => `@p${n}`);

    for (let i = 0; i < values.length; i++) {
      const name = `p${i + 1}`;
      const v = values[i];
      if (v === null || v === undefined) {
        base.input(name, mssql.NVarChar, null);
      } else if (v instanceof Date) {
        base.input(name, mssql.DateTimeOffset, v);
      } else if (typeof v === 'boolean') {
        base.input(name, mssql.Bit, v ? 1 : 0);
      } else if (typeof v === 'number') {
        base.input(name, mssql.Float, v);
      } else {
        // string (including JSON strings and UUIDs)
        base.input(name, mssql.NVarChar, String(v));
      }
    }
  }

  return { sql: converted, request: base };
}

// ---------------------------------------------------------------------------
// PoolClient supports pg-like autocommit queries and explicit transactions.
// ---------------------------------------------------------------------------

export class PoolClient {
  private _tx: mssql.Transaction | null = null;
  private readonly _pool: mssql.ConnectionPool;

  constructor(pool: mssql.ConnectionPool) {
    this._pool = pool;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    const upper = sql.trim().toUpperCase();

    if (upper === 'BEGIN') {
      this._tx = new mssql.Transaction(this._pool);
      await this._tx.begin();
      return { rows: [], rowCount: 0 };
    }
    if (upper === 'COMMIT') {
      if (this._tx) { await this._tx.commit(); this._tx = null; }
      return { rows: [], rowCount: 0 };
    }
    if (upper === 'ROLLBACK') {
      if (this._tx) {
        try { await this._tx.rollback(); } catch { /* ignore */ }
        this._tx = null;
      }
      return { rows: [], rowCount: 0 };
    }

    // Match pg behavior: client.query() works without BEGIN (autocommit).
    // If BEGIN was issued, route all queries through the transaction instead.
    const req = this._tx ? new mssql.Request(this._tx) : this._pool.request();
    const { sql: converted } = buildRequest(req, sql, values);
    const result = await req.query<T>(converted);
    return {
      rows: normaliseRows(result.recordset as mssql.IRecordSet<T>),
      rowCount: result.rowsAffected.reduce((a, b) => a + b, 0),
    };
  }

  release(): void {
    if (this._tx) {
      this._tx.rollback().catch(() => { /* best-effort */ });
      this._tx = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Pool: lazy singleton around mssql.ConnectionPool
// ---------------------------------------------------------------------------

class Pool {
  private _inner: mssql.ConnectionPool | null = null;
  private readonly _config: mssql.config;

  constructor(config: mssql.config) {
    this._config = config;
  }

  private async inner(): Promise<mssql.ConnectionPool> {
    if (!this._inner) {
      this._inner = await new mssql.ConnectionPool(this._config).connect();
    }
    return this._inner;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    const pool = await this.inner();
    const req = pool.request();
    const { sql: converted } = buildRequest(req, sql, values);
    const result = await req.query<T>(converted);
    return {
      rows: normaliseRows(result.recordset as mssql.IRecordSet<T>),
      rowCount: result.rowsAffected.reduce((a, b) => a + b, 0),
    };
  }

  async connect(): Promise<PoolClient> {
    await this.inner();
    return new PoolClient(this._inner!);
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

export function getPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!pool) pool = new Pool(parseConnectionString(url));
  return pool;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
