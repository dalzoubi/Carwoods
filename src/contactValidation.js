const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_RE = /^[+]?[\d\s().-]+$/;

export function looksLikeEmail(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized.length > 320) return false;
  if (!SIMPLE_EMAIL_RE.test(normalized)) return false;
  const [localPart, domainPart] = normalized.split('@');
  if (!localPart || !domainPart) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (normalized.includes('..')) return false;
  return true;
}

export function looksLikePhone(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return true;
  if (!PHONE_ALLOWED_RE.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
