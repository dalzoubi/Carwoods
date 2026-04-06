export type ValidationOk = { valid: true };
export type ValidationFail = { valid: false; field: string; message: string };
export type ValidationResult = ValidationOk | ValidationFail;

export function ok(): ValidationOk {
  return { valid: true };
}

export function fail(field: string, message: string): ValidationFail {
  return { valid: false, field, message };
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_RE = /^[+]?[\d\s().-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return false;
  if (!SIMPLE_EMAIL_RE.test(normalized)) return false;
  const [localPart, domainPart] = normalized.split('@');
  if (!localPart || !domainPart) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (normalized.includes('..')) return false;
  return true;
}

export function isValidPhone(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (!PHONE_ALLOWED_RE.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}
