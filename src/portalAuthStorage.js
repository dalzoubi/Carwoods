const PORTAL_BEARER_TOKEN_KEY = 'carwoods.portal.bearerToken';

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPortalBearerToken() {
  if (!storageAvailable()) return '';
  return window.localStorage.getItem(PORTAL_BEARER_TOKEN_KEY) ?? '';
}

export function savePortalBearerToken(token) {
  if (!storageAvailable()) return;
  if (!token) {
    window.localStorage.removeItem(PORTAL_BEARER_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(PORTAL_BEARER_TOKEN_KEY, token);
}

