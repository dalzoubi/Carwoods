import { ok, fail, isValidEmail, isValidPhone, type ValidationResult } from './validation.js';

export function validateProfileUpdate(input: {
  email: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
}): ValidationResult {
  if (!input.email) {
    return fail('email', 'missing_email');
  }
  if (!isValidEmail(input.email)) {
    return fail('email', 'invalid_email');
  }
  if (input.firstName !== undefined && input.firstName.length > 100) {
    return fail('first_name', 'first_name_too_long');
  }
  if (input.lastName !== undefined && input.lastName.length > 100) {
    return fail('last_name', 'last_name_too_long');
  }
  if (input.phone !== undefined) {
    if (input.phone.length > 50) {
      return fail('phone', 'phone_too_long');
    }
    if (!isValidPhone(input.phone)) {
      return fail('phone', 'invalid_phone');
    }
  }
  return ok();
}

export function validateLandlordInvite(input: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): ValidationResult {
  if (!isValidEmail(input.email)) {
    return fail('email', 'invalid_email');
  }
  if (!input.firstName) {
    return fail('first_name', 'missing_first_name');
  }
  if (!input.lastName) {
    return fail('last_name', 'missing_last_name');
  }
  if (input.firstName.length > 100) {
    return fail('first_name', 'first_name_too_long');
  }
  if (input.lastName.length > 100) {
    return fail('last_name', 'last_name_too_long');
  }
  return ok();
}
