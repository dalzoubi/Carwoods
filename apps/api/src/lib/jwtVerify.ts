import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getOpenIdMetadata } from './openIdMetadata.js';

export type AccessTokenClaims = {
  sub: string;
  oid?: string;
  name?: string;
  email?: string;
  emails?: string[];
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
  return claims.email ?? claims.emails?.[0];
}

/**
 * Validates Firebase ID tokens for this API (audience + issuer + signature).
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID must be set for JWT validation');
  }
  const issuer = `https://securetoken.google.com/${projectId}`;
  const keySet = await getJwks();
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience: projectId,
  });
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) {
    throw new Error('Token missing sub');
  }
  return {
    sub,
    oid: readString(payload.oid),
    name: readString(payload.name),
    email: readString(payload.email),
    emails: readStringArray(payload.emails),
    given_name: readString(payload.given_name),
    family_name: readString(payload.family_name),
  };
}

export function authConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim()
  );
}
