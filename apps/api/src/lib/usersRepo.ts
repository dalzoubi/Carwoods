import type { PoolClient, QueryResult } from './db.js';
import { primaryEmailFromClaims, type AccessTokenClaims } from './jwtVerify.js';

export type UserRow = {
  id: string;
  external_auth_oid: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  status: string;
};

export const UserRole = {
  ADMIN: 'ADMIN',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeNamePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveNamesFromClaims(claims: AccessTokenClaims): { firstName: string | null; lastName: string | null } {
  const firstName = normalizeNamePart(claims.given_name);
  const lastName = normalizeNamePart(claims.family_name);
  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const displayName = normalizeNamePart(claims.name);
  if (!displayName) {
    return { firstName: null, lastName: null };
  }

  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export async function findUserBySubject(
  client: Queryable,
  externalAuthOid: string
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, role, status
     FROM users WHERE external_auth_oid = $1`,
    [externalAuthOid]
  );
  return r.rows[0] ?? null;
}

export async function findUserByEmail(
  client: Queryable,
  email: string
): Promise<UserRow | null> {
  const normalized = normalizeEmail(email);
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, role, status
     FROM users
     WHERE LOWER(email) = $1`,
    [normalized]
  );
  return r.rows[0] ?? null;
}

export async function findUserById(
  client: Queryable,
  id: string
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, role, status
     FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

/**
 * Links a token subject (oid or sub) to an existing user row so future
 * logins match instantly by subject instead of requiring the email claim.
 */
export async function linkSubjectToUser(
  client: Queryable,
  userId: string,
  externalAuthOid: string
): Promise<void> {
  await client.query(
    `UPDATE users
        SET external_auth_oid = $1, updated_at = GETUTCDATE()
      WHERE id = $2
        AND (external_auth_oid IS NULL
             OR external_auth_oid = ''
             OR external_auth_oid LIKE 'seed:%')`,
    [externalAuthOid, userId]
  );
}

export async function syncUserProfileFromClaims(
  client: Queryable,
  userId: string,
  claims: AccessTokenClaims
): Promise<void> {
  const { firstName, lastName } = deriveNamesFromClaims(claims);
  if (!firstName && !lastName) {
    return;
  }

  await client.query(
    `UPDATE users
        SET first_name = COALESCE(NULLIF($2, ''), first_name),
            last_name = COALESCE(NULLIF($3, ''), last_name),
            updated_at = GETUTCDATE()
      WHERE id = $1`,
    [userId, firstName, lastName]
  );
}

export async function findUserByClaims(
  client: Queryable,
  claims: AccessTokenClaims
): Promise<UserRow | null> {
  const preferredSubject = claims.oid ?? claims.sub;
  const subjectCandidates = [claims.oid, claims.sub].filter(
    (value, index, arr): value is string =>
      Boolean(value && value.trim().length > 0 && arr.indexOf(value) === index)
  );
  for (const subject of subjectCandidates) {
    const bySubject = await findUserBySubject(client, subject);
    if (bySubject) {
      await syncUserProfileFromClaims(client, bySubject.id, claims);
      return findUserBySubject(client, subject);
    }
  }

  const emailCandidates = [
    primaryEmailFromClaims(claims),
    ...(claims.emails ?? []),
  ].filter((value, index, arr): value is string => Boolean(value && arr.indexOf(value) === index));

  for (const email of emailCandidates) {
    const byEmail = await findUserByEmail(client, email);
    if (byEmail) {
      if (preferredSubject) {
        await linkSubjectToUser(client, byEmail.id, preferredSubject);
      }
      await syncUserProfileFromClaims(client, byEmail.id, claims);
      return findUserById(client, byEmail.id);
    }
  }

  return findUserBySubject(client, claims.sub);
}

/**
 * Ensures the caller has a management row keyed by JWT `sub`.
 * T-SQL MERGE replaces the PostgreSQL INSERT … ON CONFLICT DO UPDATE.
 */
export async function ensureManagementUser(
  client: PoolClient,
  claims: AccessTokenClaims,
  role: UserRoleType
): Promise<UserRow> {
  const email = primaryEmailFromClaims(claims) ?? 'user@unknown';
  const sub = claims.sub;
  const firstName = claims.given_name ?? null;
  const lastName = claims.family_name ?? null;

  const r = await client.query<UserRow>(
    `MERGE users AS target
     USING (SELECT $1 AS external_auth_oid) AS src
       ON target.external_auth_oid = src.external_auth_oid
     WHEN MATCHED THEN
       UPDATE SET
         email       = $2,
         role        = $5,
         status      = 'ACTIVE',
         first_name  = COALESCE($3, target.first_name),
         last_name   = COALESCE($4, target.last_name),
         updated_at  = GETUTCDATE()
     WHEN NOT MATCHED THEN
       INSERT (id, external_auth_oid, email, first_name, last_name, role, status)
       VALUES (NEWID(), $1, $2, $3, $4, $5, 'ACTIVE')
     OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
            INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
            INSERTED.role, INSERTED.status;`,
    [sub, email, firstName, lastName, role]
  );
  return r.rows[0]!;
}
