import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getOpenIdMetadata } from './openIdMetadata.js';

export type AccessTokenClaims = {
  sub: string;
  oid?: string;
  email?: string;
  upn?: string;
  emails?: string[];
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

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

export function primaryEmailFromClaims(claims: AccessTokenClaims): string | undefined {
  return claims.email ?? claims.preferred_username ?? claims.upn ?? claims.emails?.[0];
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
    oid: readString(payload.oid),
    email: readString(payload.email),
    upn: readString(payload.upn),
    emails: readStringArray(payload.emails),
    preferred_username: readString(payload.preferred_username),
    given_name: readString(payload.given_name),
    family_name: readString(payload.family_name),
  };
}

export function entraAuthConfigured(): boolean {
  return Boolean(
    process.env.ENTRA_ISSUER?.trim() &&
      process.env.ENTRA_API_AUDIENCE?.trim() &&
      (process.env.ENTRA_OPENID_METADATA_URL?.trim() || process.env.ENTRA_ISSUER?.trim())
  );
}
