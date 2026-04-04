import type { PoolClient, QueryResult } from './db.js';
import { primaryEmailFromClaims, type AccessTokenClaims } from './jwtVerify.js';

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

export async function findUserBySubject(
  client: Queryable,
  externalAuthSubject: string
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_subject, email, first_name, last_name, phone, role, status
     FROM users WHERE external_auth_subject = $1`,
    [externalAuthSubject]
  );
  return r.rows[0] ?? null;
}

export async function findUserByEmail(
  client: Queryable,
  email: string
): Promise<UserRow | null> {
  const normalized = normalizeEmail(email);
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_subject, email, first_name, last_name, phone, role, status
     FROM users
     WHERE LOWER(email) = $1`,
    [normalized]
  );
  return r.rows[0] ?? null;
}

export async function findUserByClaims(
  client: Queryable,
  claims: AccessTokenClaims
): Promise<UserRow | null> {
  const subjectCandidates = [claims.oid, claims.sub].filter(
    (value, index, arr): value is string =>
      Boolean(value && value.trim().length > 0 && arr.indexOf(value) === index)
  );
  for (const subject of subjectCandidates) {
    const bySubject = await findUserBySubject(client, subject);
    if (bySubject) return bySubject;
  }

  const emailCandidates = [
    primaryEmailFromClaims(claims),
    ...(claims.emails ?? []),
  ].filter((value, index, arr): value is string => Boolean(value && arr.indexOf(value) === index));

  for (const email of emailCandidates) {
    const byEmail = await findUserByEmail(client, email);
    if (byEmail) return byEmail;
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
     USING (SELECT $1 AS external_auth_subject) AS src
       ON target.external_auth_subject = src.external_auth_subject
     WHEN MATCHED THEN
       UPDATE SET
         email       = $2,
         role        = $5,
         status      = 'ACTIVE',
         first_name  = COALESCE($3, target.first_name),
         last_name   = COALESCE($4, target.last_name),
         updated_at  = GETUTCDATE()
     WHEN NOT MATCHED THEN
       INSERT (id, external_auth_subject, email, first_name, last_name, role, status)
       VALUES (NEWID(), $1, $2, $3, $4, $5, 'ACTIVE')
     OUTPUT INSERTED.id, INSERTED.external_auth_subject, INSERTED.email,
            INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
            INSERTED.role, INSERTED.status;`,
    [sub, email, firstName, lastName, role]
  );
  return r.rows[0]!;
}
