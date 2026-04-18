import type { RentLedgerEntryRow } from './rentLedgerRepo.js';

/**
 * MSSQL/Tedious sometimes returns DECIMAL and DATE values in shapes that confuse
 * JSON serialization or the SPA. Normalize each row to plain JSON-safe values.
 */

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Calendar day YYYY-MM-DD from DATE, ISO string, or JS Date. */
function toDateOnlyString(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1];
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function toIsoDateTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function rentLedgerEntryToApiJson(row: RentLedgerEntryRow): Record<string, unknown> {
  const paidRaw = row.paid_date;
  const paidStr = paidRaw != null && paidRaw !== '' ? toDateOnlyString(paidRaw) : '';
  return {
    id: String(row.id),
    lease_id: String(row.lease_id),
    period_start: toDateOnlyString(row.period_start),
    amount_due: toFiniteNumber(row.amount_due),
    amount_paid: toFiniteNumber(row.amount_paid),
    due_date: toDateOnlyString(row.due_date),
    paid_date: paidStr === '' ? null : paidStr,
    payment_method: row.payment_method,
    notes: row.notes,
    recorded_by: row.recorded_by != null ? String(row.recorded_by) : null,
    created_at: toIsoDateTime(row.created_at) ?? '',
    updated_at: toIsoDateTime(row.updated_at) ?? '',
    payment_status: row.payment_status,
  };
}

export function rentLedgerEntriesToApiJson(entries: RentLedgerEntryRow[]): Record<string, unknown>[] {
  return entries.map(rentLedgerEntryToApiJson);
}
