type OpenIdMetadata = {
  jwks_uri: string;
  issuer?: string;
};

let cached: OpenIdMetadata | null = null;
let cachedAt = 0;
const OPEN_ID_METADATA_TTL_SECONDS = 3600;
const OPEN_ID_METADATA_TTL_MS = OPEN_ID_METADATA_TTL_SECONDS * 1000;

function metadataUrl(): string {
  const explicit = process.env.FIREBASE_OPENID_METADATA_URL?.trim();
  if (explicit) return explicit;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error('Set FIREBASE_PROJECT_ID or FIREBASE_OPENID_METADATA_URL');
  }
  return `https://securetoken.google.com/${projectId}/.well-known/openid-configuration`;
}

/**
 * Cached OpenID metadata (JWKS URI). Refreshes hourly per instance.
 */
export async function getOpenIdMetadata(): Promise<OpenIdMetadata> {
  if (cached && Date.now() - cachedAt < OPEN_ID_METADATA_TTL_MS) {
    return cached;
  }

  const url = metadataUrl();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`OpenID metadata HTTP ${res.status}`);
    }
    const body = (await res.json()) as { jwks_uri?: string; issuer?: string };
    if (!body.jwks_uri) {
      throw new Error('OpenID metadata missing jwks_uri');
    }
    cached = { jwks_uri: body.jwks_uri, issuer: body.issuer };
    cachedAt = Date.now();
    return cached;
  } catch (error) {
    if (cached) {
      console.warn(
        '[auth] Failed to refresh OpenID metadata; using stale cached value',
        error,
      );
      return cached;
    }
    throw error;
  }
}
