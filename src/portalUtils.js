import { Role } from './domain/constants.js';

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
  ) return Role.LANDLORD;
  return normalized;
}

export function emailFromAccount(account) {
  return typeof account?.username === 'string' ? account.username.trim() : '';
}

function isActivePortalStatus(status) {
  const normalized = String(status ?? '').trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'INVITED';
}

/**
 * Resolves the effective role only from an active portal user row.
 */
export function resolveRole(meData, account) {
  void account;
  const apiRole = firstNonEmpty([
    normalizeRole(meData?.user?.role),
    normalizeRole(meData?.role),
  ]);
  if (!apiRole) return '';
  if (!isActivePortalStatus(meData?.user?.status)) return '';
  return apiRole;
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
  return normalized !== Role.TENANT
    && normalized !== Role.LANDLORD
    && normalized !== Role.ADMIN
    && normalized !== Role.AI_AGENT;
}
