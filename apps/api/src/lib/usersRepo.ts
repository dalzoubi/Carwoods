import type pg from 'pg';
import type { AccessTokenClaims } from './jwtVerify.js';

export type UserRow = {
  id: string;
  external_auth_subject: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  status: string;
};

export async function findUserBySubject(
  client: pg.PoolClient,
  externalAuthSubject: string
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_subject, email, first_name, last_name, phone, role, status
     FROM users WHERE external_auth_subject = $1`,
    [externalAuthSubject]
  );
  return r.rows[0] ?? null;
}

/**
 * Ensures the caller has an ADMIN row keyed by JWT `sub`.
 */
export async function ensureAdminUser(
  client: pg.PoolClient,
  claims: AccessTokenClaims
): Promise<UserRow> {
  const email =
    claims.email ??
    claims.preferred_username ??
    'admin@unknown';
  const r = await client.query<UserRow>(
    `INSERT INTO users (external_auth_subject, email, first_name, last_name, role, status)
     VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE')
     ON CONFLICT (external_auth_subject) DO UPDATE SET
       email = EXCLUDED.email,
       role = 'ADMIN',
       status = 'ACTIVE',
       first_name = COALESCE(EXCLUDED.first_name, users.first_name),
       last_name = COALESCE(EXCLUDED.last_name, users.last_name),
       updated_at = now()
     RETURNING id, external_auth_subject, email, first_name, last_name, phone, role, status`,
    [claims.sub, email, claims.given_name ?? null, claims.family_name ?? null]
  );
  return r.rows[0]!;
}
