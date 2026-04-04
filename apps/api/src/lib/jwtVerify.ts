import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getOpenIdMetadata } from './openIdMetadata.js';

export type AccessTokenClaims = {
  sub: string;
  oid?: string;
  role?: string;
  roles?: string[];
  app_roles?: string[];
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

const GUID_USERNAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@/i;

function looksLikeRealEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (GUID_USERNAME_RE.test(value)) return undefined;
  return value;
}

export function primaryEmailFromClaims(claims: AccessTokenClaims): string | undefined {
  return (
    claims.email ??
    looksLikeRealEmail(claims.preferred_username) ??
    claims.upn ??
    claims.emails?.[0]
  );
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
    role: readString(payload.role),
    roles: readStringArray(payload.roles),
    app_roles: readStringArray(payload.app_roles),
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
