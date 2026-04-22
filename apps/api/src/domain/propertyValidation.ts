import { ok, fail, type ValidationResult } from './validation.js';

export function validateCreateProperty(input: {
  street: string | undefined;
  city: string | undefined;
  state: string | undefined;
  zip: string | undefined;
}): ValidationResult {
  if (!input.street || !input.city || !input.state || !input.zip) {
    return fail('fields', 'missing_required_fields');
  }
  return ok();
}

/**
 * Update allows partial patches, so missing keys are fine. But when a required
 * address field IS supplied it must not be empty — otherwise we would persist
 * a blank address that the create flow would have rejected.
 */
export function validateUpdatePropertyAddress(input: {
  street: string | undefined;
  city: string | undefined;
  state: string | undefined;
  zip: string | undefined;
}): ValidationResult {
  const entries: Array<[keyof typeof input, string | undefined]> = [
    ['street', input.street],
    ['city', input.city],
    ['state', input.state],
    ['zip', input.zip],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value.trim() === '') {
      return fail(key, 'missing_required_fields');
    }
  }
  return ok();
}
