import { ok, fail, type ValidationResult } from './validation.js';

export const LEASE_STATUSES = new Set(['ACTIVE', 'ENDED', 'UPCOMING', 'TERMINATED']);

const RENT_MAX = 999_999_999.99;

export type RentAmountParseResult =
  | { ok: true; amount: number | null | undefined }
  | { ok: false; message: string };

/**
 * Parse optional rent amount for API bodies.
 * - `undefined`: omit (caller keeps existing DB value or inserts NULL when creating without key).
 * - `null` or `""`: store NULL in DB.
 * - number or numeric string: validated, rounded to cents.
 */
export function parseRentAmountInput(value: unknown): RentAmountParseResult {
  if (value === undefined) {
    return { ok: true, amount: undefined };
  }
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return { ok: true, amount: null };
  }
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) {
    return { ok: false, message: 'invalid_rent_amount' };
  }
  if (n < 0 || n > RENT_MAX) {
    return { ok: false, message: 'invalid_rent_amount' };
  }
  const cents = Math.round(n * 100);
  const rounded = cents / 100;
  return { ok: true, amount: rounded };
}

export function validateCreateLease(input: {
  property_id: string | undefined;
  start_date: string | undefined;
  status: string | undefined;
}): ValidationResult {
  if (!input.property_id || !input.start_date || !input.status) {
    return fail('fields', 'missing_or_invalid_fields');
  }
  if (!LEASE_STATUSES.has(input.status)) {
    return fail('status', 'missing_or_invalid_fields');
  }
  return ok();
}

export function validateLeaseStatus(status: string | undefined): ValidationResult {
  if (status === undefined) return ok();
  if (!LEASE_STATUSES.has(status)) {
    return fail('status', 'invalid_status');
  }
  return ok();
}
