/**
 * Comma-separated Entra object IDs (`oid` claim) allowed to call admin APIs.
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

export function isAdminOid(oid: string | undefined, sub: string): boolean {
  const allowed = getAdminObjectIds();
  if (allowed.size === 0) return false;
  if (oid && allowed.has(oid)) return true;
  return allowed.has(sub);
}
