const ID_TOKEN_CLAIMS_STORAGE_KEY = 'portal.idTokenClaimsByHomeAccountId';

export function readStoredClaimsByHomeAccountId() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(ID_TOKEN_CLAIMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeStoredClaimsByHomeAccountId(map) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ID_TOKEN_CLAIMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort cache persistence.
  }
}

export function persistIdTokenClaims(account, idTokenClaims) {
  const homeAccountId = account?.homeAccountId;
  if (!homeAccountId || !idTokenClaims || typeof idTokenClaims !== 'object') return;
  const current = readStoredClaimsByHomeAccountId();
  current[homeAccountId] = idTokenClaims;
  writeStoredClaimsByHomeAccountId(current);
}

export function hydrateAccountClaims(account) {
  if (!account) return null;
  if (account.idTokenClaims) return account;
  const homeAccountId = account.homeAccountId;
  if (!homeAccountId) return account;
  const claims = readStoredClaimsByHomeAccountId()[homeAccountId];
  if (!claims || typeof claims !== 'object') return account;
  return { ...account, idTokenClaims: claims };
}
