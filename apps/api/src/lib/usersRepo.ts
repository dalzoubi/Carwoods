import type { PoolClient, QueryResult } from './db.js';
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

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

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

/**
 * Ensures the caller has an ADMIN row keyed by JWT `sub`.
 * T-SQL MERGE replaces the PostgreSQL INSERT … ON CONFLICT DO UPDATE.
 */
export async function ensureAdminUser(
  client: PoolClient,
  claims: AccessTokenClaims
): Promise<UserRow> {
  const email = claims.email ?? claims.preferred_username ?? 'admin@unknown';
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
         role        = 'ADMIN',
         status      = 'ACTIVE',
         first_name  = COALESCE($3, target.first_name),
         last_name   = COALESCE($4, target.last_name),
         updated_at  = GETUTCDATE()
     WHEN NOT MATCHED THEN
       INSERT (id, external_auth_subject, email, first_name, last_name, role, status)
       VALUES (NEWID(), $1, $2, $3, $4, 'ADMIN', 'ACTIVE')
     OUTPUT INSERTED.id, INSERTED.external_auth_subject, INSERTED.email,
            INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
            INSERTED.role, INSERTED.status;`,
    [sub, email, firstName, lastName]
  );
  return r.rows[0]!;
}
