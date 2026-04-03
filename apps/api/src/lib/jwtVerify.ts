import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getOpenIdMetadata } from './openIdMetadata.js';

export type AccessTokenClaims = {
  sub: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getJwks() {
  if (jwks) return jwks;
  const meta = await getOpenIdMetadata();
  jwks = createRemoteJWKSet(new URL(meta.jwks_uri));
  return jwks;
}

export function getBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const t = authHeader.slice('Bearer '.length).trim();
  return t || null;
}

/**
 * Validates Entra / External ID access tokens for this API (audience + issuer + signature).
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const issuer = process.env.ENTRA_ISSUER?.trim();
  const audience = process.env.ENTRA_API_AUDIENCE?.trim();
  if (!issuer || !audience) {
    throw new Error('ENTRA_ISSUER and ENTRA_API_AUDIENCE must be set for JWT validation');
  }
  const keySet = await getJwks();
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
  });
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) {
    throw new Error('Token missing sub');
  }
  return {
    sub,
    oid: typeof payload.oid === 'string' ? payload.oid : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    preferred_username:
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
    given_name: typeof payload.given_name === 'string' ? payload.given_name : undefined,
    family_name: typeof payload.family_name === 'string' ? payload.family_name : undefined,
  };
}

export function entraAuthConfigured(): boolean {
  return Boolean(
    process.env.ENTRA_ISSUER?.trim() &&
      process.env.ENTRA_API_AUDIENCE?.trim() &&
      (process.env.ENTRA_OPENID_METADATA_URL?.trim() || process.env.ENTRA_ISSUER?.trim())
  );
}
