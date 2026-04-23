import type { QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type RollupResult = {
  date: string;
  rowsDeleted: number;
  rowsInserted: number;
};

/**
 * Aggregate cost_events for a single UTC date into cost_daily_rollup.
 * Idempotent: deletes any existing rows for that date before inserting fresh aggregates.
 */
export async function aggregateDailyCosts(
  db: Queryable,
  targetDateUtc: string
): Promise<RollupResult> {
  const deleted = await db.query(
    `DELETE FROM cost_daily_rollup WHERE rollup_date = $1`,
    [targetDateUtc]
  );

  const inserted = await db.query(
    `INSERT INTO cost_daily_rollup
       (rollup_date, landlord_id, property_id, service, event_count, total_units, total_cost_usd, last_updated_at)
     SELECT
       CAST(SWITCHOFFSET(occurred_at, '+00:00') AS DATE) AS rollup_date,
       landlord_id,
       property_id,
       service,
       COUNT(*)                    AS event_count,
       SUM(units)                  AS total_units,
       SUM(estimated_cost_usd)     AS total_cost_usd,
       SYSDATETIMEOFFSET()         AS last_updated_at
     FROM cost_events
     WHERE CAST(SWITCHOFFSET(occurred_at, '+00:00') AS DATE) = $1
     GROUP BY
       CAST(SWITCHOFFSET(occurred_at, '+00:00') AS DATE),
       landlord_id,
       property_id,
       service`,
    [targetDateUtc]
  );

  return {
    date: targetDateUtc,
    rowsDeleted: deleted.rowCount ?? 0,
    rowsInserted: inserted.rowCount ?? 0,
  };
}

export function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Basic YYYY-MM-DD validation — rejects obviously bad input from HTTP params. */
export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
