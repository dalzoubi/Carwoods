import type { PoolClient, QueryResult } from './db.js';
import { primaryEmailFromClaims, type AccessTokenClaims } from './jwtVerify.js';
import { Role } from '../domain/constants.js';

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

export type UpsertLandlordResult = {
  user: UserRow;
  created: boolean;
};

export { Role as UserRole };
export type UserRoleType = Role;

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function placeholderExternalAuthOidForLandlordEmail(email: string): string {
  return `seed:landlord:${normalizeEmail(email)}`;
}

function normalizeNamePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export async function upsertLandlordUserByEmail(
  client: PoolClient,
  params: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  }
): Promise<UpsertLandlordResult> {
  const normalizedEmail = normalizeEmail(params.email);
  const firstName = normalizeNamePart(params.firstName);
  const lastName = normalizeNamePart(params.lastName);
  const existing = await findUserByEmail(client, normalizedEmail);

  if (existing) {
    const role = String(existing.role ?? '').toUpperCase();
    if (role === Role.ADMIN) {
      throw new Error('email_belongs_to_admin');
    }
    if (role !== Role.LANDLORD) {
      throw new Error('email_already_used_by_non_landlord');
    }

    const updated = await client.query<UserRow>(
      `UPDATE users
          SET status = 'ACTIVE',
              first_name = COALESCE(NULLIF($2, ''), first_name),
              last_name = COALESCE(NULLIF($3, ''), last_name),
              external_auth_oid = CASE
                WHEN external_auth_oid IS NULL
                  OR external_auth_oid = ''
                  OR external_auth_oid LIKE 'seed:%'
                THEN $4
                ELSE external_auth_oid
              END,
              updated_at = GETUTCDATE()
        OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
               INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
               INSERTED.role, INSERTED.status
        WHERE id = $1`,
      [existing.id, firstName, lastName, placeholderExternalAuthOidForLandlordEmail(normalizedEmail)]
    );
    return {
      user: updated.rows[0] ?? existing,
      created: false,
    };
  }

  const inserted = await client.query<UserRow>(
    `INSERT INTO users (id, external_auth_oid, email, first_name, last_name, role, status)
     OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
            INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
            INSERTED.role, INSERTED.status
     VALUES (NEWID(), $1, $2, $3, $4, '${Role.LANDLORD}', 'ACTIVE')`,
    [placeholderExternalAuthOidForLandlordEmail(normalizedEmail), normalizedEmail, firstName, lastName]
  );

  return {
    user: inserted.rows[0]!,
    created: true,
  };
}

export async function listLandlords(
  client: Queryable,
  options?: { includeInactive?: boolean }
): Promise<UserRow[]> {
  if (options?.includeInactive) {
    const r = await client.query<UserRow>(
      `SELECT id, external_auth_oid, email, first_name, last_name, phone, role, status
       FROM users
       WHERE role = '${Role.LANDLORD}'
       ORDER BY status DESC, last_name ASC, first_name ASC, email ASC`
    );
    return r.rows;
  }
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, role, status
     FROM users
     WHERE role = '${Role.LANDLORD}'
       AND status = 'ACTIVE'
     ORDER BY last_name ASC, first_name ASC, email ASC`
  );
  return r.rows;
}

export async function setLandlordActiveStatus(
  client: Queryable,
  id: string,
  active: boolean
): Promise<UserRow | null> {
  const nextStatus = active ? 'ACTIVE' : 'DISABLED';
  const r = await client.query<UserRow>(
    `UPDATE users
        SET status = $2,
            updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
             INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
             INSERTED.role, INSERTED.status
      WHERE id = $1
        AND role = '${Role.LANDLORD}'`,
    [id, nextStatus]
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

export async function findUserByClaims(
  client: Queryable,
  claims: AccessTokenClaims,
  options?: { emailHint?: string; logger?: { warn?: (...args: unknown[]) => void } }
): Promise<UserRow | null> {
  const preferredSubject = claims.oid ?? claims.sub;
  const log = options?.logger;

  const subjectCandidates = [claims.oid, claims.sub].filter(
    (value, index, arr): value is string =>
      Boolean(value && value.trim().length > 0 && arr.indexOf(value) === index)
  );
  for (const subject of subjectCandidates) {
    const bySubject = await findUserBySubject(client, subject);
    if (bySubject) {
      return bySubject;
    }
  }

  const emailCandidates = [
    primaryEmailFromClaims(claims),
    ...(claims.emails ?? []),
    options?.emailHint,
  ].filter(
    (value, index, arr): value is string =>
      Boolean(value && value.trim().length > 0 && arr.indexOf(value) === index)
  );

  if (emailCandidates.length === 0) {
    log?.warn?.(
      'findUserByClaims: no email candidates from token or hint; subject lookup only',
      { sub: claims.sub, oid: claims.oid }
    );
  }

  for (const email of emailCandidates) {
    const byEmail = await findUserByEmail(client, email);
    if (byEmail) {
      if (preferredSubject) {
        await linkSubjectToUser(client, byEmail.id, preferredSubject);
        log?.warn?.(
          'findUserByClaims: linked subject to pre-seeded user via email fallback',
          { userId: byEmail.id, email, subject: preferredSubject }
        );
      }
      return findUserById(client, byEmail.id);
    }
  }

  return findUserBySubject(client, claims.sub);
}

export async function updateUserProfile(
  client: Queryable,
  userId: string,
  profile: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }
): Promise<UserRow | null> {
  const normalizedEmail = normalizeEmail(profile.email);
  const firstName = normalizeNamePart(profile.firstName);
  const lastName = normalizeNamePart(profile.lastName);
  const phone = normalizePhone(profile.phone);
  const r = await client.query<UserRow>(
    `UPDATE users
        SET email = $2,
            first_name = $3,
            last_name = $4,
            phone = $5,
            updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
             INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
             INSERTED.role, INSERTED.status
      WHERE id = $1
        AND (
          LOWER(email) <> $2
          OR ISNULL(first_name, '') <> ISNULL($3, '')
          OR ISNULL(last_name, '') <> ISNULL($4, '')
          OR ISNULL(phone, '') <> ISNULL($5, '')
        )`,
    [userId, normalizedEmail, firstName, lastName, phone]
  );
  if (r.rows[0]) return r.rows[0];
  return findUserById(client, userId);
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
  const email = normalizeEmail(primaryEmailFromClaims(claims) ?? 'user@unknown');
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
