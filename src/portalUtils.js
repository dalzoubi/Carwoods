export function firstNonEmpty(values) {
  for (const v of values) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) return s;
    }
  }
  return '';
}

export function normalizeRole(rawRole) {
  const normalized = String(rawRole ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return '';
  if (
    normalized === 'PROPERTY_MANAGER'
    || normalized === 'OWNER'
  ) return 'LANDLORD';
  return normalized;
}

export function roleFromAccountClaims(account) {
  const claims = account?.idTokenClaims ?? {};
  const candidates = [];
  if (typeof claims.role === 'string') candidates.push(claims.role);
  if (Array.isArray(claims.roles)) candidates.push(...claims.roles);
  if (Array.isArray(claims.app_roles)) candidates.push(...claims.app_roles);
  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate);
    if (normalized) return normalized;
  }
  return '';
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@/i;

/**
 * Extracts the real email from the MSAL account's ID token claims.
 * Skips GUID-based preferred_username values that CIAM generates for
 * social-IdP accounts.
 */
export function emailFromAccount(account) {
  const claims = account?.idTokenClaims ?? {};
  if (typeof claims.email === 'string' && claims.email.trim()) {
    return claims.email.trim();
  }
  if (Array.isArray(claims.emails) && claims.emails.length > 0) {
    const first = claims.emails[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  const pref = claims.preferred_username ?? account?.username;
  if (typeof pref === 'string' && pref.trim() && !GUID_RE.test(pref)) {
    return pref.trim();
  }
  return '';
}

/**
 * Resolves the effective role from the API response then token claims.
 */
export function resolveRole(meData, account) {
  return firstNonEmpty([
    normalizeRole(meData?.user?.role),
    normalizeRole(meData?.role),
    roleFromAccountClaims(account),
  ]);
}

/**
 * Resolves a display name from the API profile, token name, and email.
 */
export function resolveDisplayName(meData, account, fallback) {
  const userFirstName = meData?.user?.first_name ?? '';
  const userLastName = meData?.user?.last_name ?? '';
  const profileName = `${userFirstName} ${userLastName}`.trim();
  return firstNonEmpty([
    profileName,
    account?.name,
    meData?.email,
    emailFromAccount(account),
    meData?.subject,
    fallback ?? '',
  ]);
}

export function isGuestRole(role) {
  const normalized = normalizeRole(role);
  return normalized !== 'TENANT' && normalized !== 'LANDLORD' && normalized !== 'ADMIN';
}
