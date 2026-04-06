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
