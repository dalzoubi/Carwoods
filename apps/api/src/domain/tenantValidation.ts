import { ok, fail, isValidEmail, isValidPhone, type ValidationResult } from './validation.js';

export function validateTenantOnboard(input: {
  email: string | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  phone?: string | null | undefined;
  propertyId: string | undefined;
  startDate: string | undefined;
  endDate?: string | null | undefined;
  monthToMonth?: boolean;
}): ValidationResult {
  if (!input.email || !isValidEmail(input.email)) {
    return fail('email', 'invalid_email');
  }
  if (!input.firstName || input.firstName.trim().length === 0) {
    return fail('first_name', 'missing_first_name');
  }
  if (input.firstName.trim().length > 100) {
    return fail('first_name', 'first_name_too_long');
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    return fail('last_name', 'missing_last_name');
  }
  if (input.lastName.trim().length > 100) {
    return fail('last_name', 'last_name_too_long');
  }
  if (input.phone) {
    if (input.phone.length > 50) return fail('phone', 'phone_too_long');
    if (!isValidPhone(input.phone)) return fail('phone', 'invalid_phone');
  }
  if (!input.propertyId || input.propertyId.trim().length === 0) {
    return fail('property_id', 'missing_property_id');
  }
  if (!input.startDate || input.startDate.trim().length === 0) {
    return fail('start_date', 'missing_start_date');
  }
  if (!isValidDateString(input.startDate)) {
    return fail('start_date', 'invalid_start_date');
  }
  if (!input.monthToMonth) {
    if (input.endDate !== undefined && input.endDate !== null) {
      if (!isValidDateString(input.endDate)) {
        return fail('end_date', 'invalid_end_date');
      }
      if (input.endDate <= input.startDate) {
        return fail('end_date', 'end_date_before_start_date');
      }
    }
  }
  return ok();
}

/** Onboard tenant onto an existing active lease — no new lease dates required. */
export function validateTenantOnboardReuse(input: {
  email: string | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  phone?: string | null | undefined;
  propertyId: string | undefined;
}): ValidationResult {
  if (!input.email || !isValidEmail(input.email)) {
    return fail('email', 'invalid_email');
  }
  if (!input.firstName || input.firstName.trim().length === 0) {
    return fail('first_name', 'missing_first_name');
  }
  if (input.firstName.trim().length > 100) {
    return fail('first_name', 'first_name_too_long');
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    return fail('last_name', 'missing_last_name');
  }
  if (input.lastName.trim().length > 100) {
    return fail('last_name', 'last_name_too_long');
  }
  if (input.phone) {
    if (input.phone.length > 50) return fail('phone', 'phone_too_long');
    if (!isValidPhone(input.phone)) return fail('phone', 'invalid_phone');
  }
  if (!input.propertyId || input.propertyId.trim().length === 0) {
    return fail('property_id', 'missing_property_id');
  }
  return ok();
}

export function validateAddTenantLease(input: {
  startDate: string | undefined;
  endDate?: string | null | undefined;
  monthToMonth?: boolean;
}): ValidationResult {
  if (!input.startDate || input.startDate.trim().length === 0) {
    return fail('start_date', 'missing_start_date');
  }
  if (!isValidDateString(input.startDate)) {
    return fail('start_date', 'invalid_start_date');
  }
  if (!input.monthToMonth) {
    if (input.endDate !== undefined && input.endDate !== null) {
      if (!isValidDateString(input.endDate)) {
        return fail('end_date', 'invalid_end_date');
      }
      if (input.endDate <= input.startDate) {
        return fail('end_date', 'end_date_before_start_date');
      }
    }
  }
  return ok();
}

function isValidDateString(value: string): boolean {
  // Expects YYYY-MM-DD
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}
