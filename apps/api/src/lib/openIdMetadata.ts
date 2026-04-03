type OpenIdMetadata = {
  jwks_uri: string;
  issuer?: string;
};

let cached: OpenIdMetadata | null = null;

function metadataUrl(): string {
  const explicit = process.env.ENTRA_OPENID_METADATA_URL?.trim();
  if (explicit) return explicit;
  const issuer = process.env.ENTRA_ISSUER?.trim().replace(/\/$/, '');
  if (!issuer) {
    throw new Error('Set ENTRA_ISSUER or ENTRA_OPENID_METADATA_URL');
  }
  return `${issuer}/.well-known/openid-configuration`;
}

/**
 * Cached OpenID metadata (JWKS URI). Cold-start fetch once per instance.
 */
export async function getOpenIdMetadata(): Promise<OpenIdMetadata> {
  if (cached) return cached;
  const url = metadataUrl();
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`OpenID metadata HTTP ${res.status}`);
  }
  const body = (await res.json()) as { jwks_uri?: string; issuer?: string };
  if (!body.jwks_uri) {
    throw new Error('OpenID metadata missing jwks_uri');
  }
  cached = { jwks_uri: body.jwks_uri, issuer: body.issuer };
  return cached;
}
