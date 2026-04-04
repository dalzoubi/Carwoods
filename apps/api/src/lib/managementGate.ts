/**
 * Comma-separated Entra object IDs (`oid` claim) allowed to call ADMIN APIs.
 */
export function getAdminObjectIds(): Set<string> {
  const raw = process.env.ENTRA_ADMIN_OBJECT_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Comma-separated Entra object IDs (`oid` claim) allowed to call LANDLORD APIs.
 */
export function getLandlordObjectIds(): Set<string> {
  const raw = process.env.ENTRA_LANDLORD_OBJECT_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function hasAllowedId(allowed: Set<string>, oid: string | undefined, sub: string): boolean {
  if (allowed.size === 0) return false;
  if (oid && allowed.has(oid)) return true;
  return allowed.has(sub);
}

export function isAdminOid(oid: string | undefined, sub: string): boolean {
  const allowed = getAdminObjectIds();
  return hasAllowedId(allowed, oid, sub);
}

export function isLandlordOid(oid: string | undefined, sub: string): boolean {
  const allowed = getLandlordObjectIds();
  return hasAllowedId(allowed, oid, sub);
}

export type ManagementRole = 'ADMIN' | 'LANDLORD';

export function resolveManagementRole(
  oid: string | undefined,
  sub: string
): ManagementRole | null {
  if (isAdminOid(oid, sub)) return 'ADMIN';
  if (isLandlordOid(oid, sub)) return 'LANDLORD';
  return null;
}

