import type { QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

export type VendorSyncLogInput = {
  vendor: string;
  billingDate: string;
  status: string;
  actualCostUsd: number | null;
  estimatedCostUsd: number | null;
  currency: string;
  errorMessage: string | null;
  rawData: string | null;
};

export type VendorSyncLogRow = {
  id: string;
  synced_at: string;
  vendor: string;
  billing_date: string;
  status: string;
  actual_cost_usd: number | null;
  estimated_cost_usd: number | null;
  currency: string;
  error_message: string | null;
};

/** Inserts a sync record. Never throws — log failures must not abort the sync run. */
export async function insertVendorSyncLog(db: Queryable, entry: VendorSyncLogInput): Promise<void> {
  try {
    await db.query(
      `INSERT INTO vendor_sync_log
         (vendor, billing_date, status, actual_cost_usd, estimated_cost_usd, currency, error_message, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.vendor,
        entry.billingDate,
        entry.status,
        entry.actualCostUsd,
        entry.estimatedCostUsd,
        entry.currency,
        entry.errorMessage,
        entry.rawData,
      ]
    );
  } catch {
    // Swallow — cost-event logging failures must never crash the sync run.
  }
}

/** Returns recent sync logs, newest first. raw_data is excluded (can be large). */
export async function getVendorSyncLogs(
  db: Queryable,
  params: { vendor?: string; billingDate?: string; limit?: number }
): Promise<VendorSyncLogRow[]> {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.vendor) {
    values.push(params.vendor);
    conditions.push(`vendor = $${values.length}`);
  }
  if (params.billingDate) {
    values.push(params.billingDate);
    conditions.push(`billing_date = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query<VendorSyncLogRow>(
    `SELECT TOP (${limit}) id, synced_at, vendor, billing_date, status,
            actual_cost_usd, estimated_cost_usd, currency, error_message
     FROM vendor_sync_log
     ${where}
     ORDER BY synced_at DESC`,
    values
  );
  return result.rows;
}

/** Returns the summed estimated cost from cost_daily_rollup for one service on one date. */
export async function getEstimatedCostForDate(
  db: Queryable,
  billingDate: string,
  service: string
): Promise<number> {
  const result = await db.query<{ estimated: number | null }>(
    `SELECT SUM(total_cost_usd) AS estimated
     FROM cost_daily_rollup
     WHERE rollup_date = $1 AND service = $2`,
    [billingDate, service]
  );
  return Number(result.rows[0]?.estimated ?? 0);
}
