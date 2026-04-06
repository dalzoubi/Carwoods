import { ok, fail, type ValidationResult } from './validation.js';

export const LEASE_STATUSES = new Set(['ACTIVE', 'ENDED', 'UPCOMING', 'TERMINATED']);

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
