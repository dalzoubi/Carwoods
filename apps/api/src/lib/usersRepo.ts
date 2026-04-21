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
  profile_photo_storage_path: string | null;
  role: string;
  status: string;
  ui_language: string | null;
  tier_id: string | null;
  ui_color_scheme: string | null;
  portal_tour_completed: boolean;
};

/** Landlord row returned by {@link listLandlords} (admin list), including joined tier labels. */
export type LandlordAdminListRow = Pick<
  UserRow,
  | 'id'
  | 'external_auth_oid'
  | 'email'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'profile_photo_storage_path'
  | 'role'
  | 'status'
  | 'tier_id'
> & {
  tier_name: string | null;
  tier_display_name: string | null;
  /** From subscription_tiers.max_properties; null when landlord has no tier. */
  tier_max_properties: number | null;
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
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, profile_photo_storage_path, role, status, ui_language, ui_color_scheme, portal_tour_completed, tier_id
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
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, profile_photo_storage_path, role, status, ui_language, ui_color_scheme, portal_tour_completed, tier_id
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
    phone?: string | null;
  }
): Promise<UpsertLandlordResult> {
  const normalizedEmail = normalizeEmail(params.email);
  const firstName = normalizeNamePart(params.firstName);
  const lastName = normalizeNamePart(params.lastName);
  const phone = normalizePhone(params.phone);
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
              phone = COALESCE($5, phone),
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
               INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
               INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
        WHERE id = $1`,
      [existing.id, firstName, lastName, placeholderExternalAuthOidForLandlordEmail(normalizedEmail), phone]
    );
    return {
      user: updated.rows[0] ?? existing,
      created: false,
    };
  }

  const inserted = await client.query<UserRow>(
    `INSERT INTO users (id, external_auth_oid, email, first_name, last_name, phone, role, status)
     OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
            INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
            INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
            INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
     VALUES (NEWID(), $1, $2, $3, $4, $5, '${Role.LANDLORD}', 'ACTIVE')`,
    [placeholderExternalAuthOidForLandlordEmail(normalizedEmail), normalizedEmail, firstName, lastName, phone]
  );

  return {
    user: inserted.rows[0]!,
    created: true,
  };
}

/**
 * Auto-register a brand-new landlord on first sign-in.
 *
 * Only creates a record when no user with this email exists yet.
 * Returns null if the user already exists (ACTIVE, DISABLED, etc.) — the
 * caller should let the normal /me flow handle that case.
 * Returns null if no email can be extracted from the token claims.
 */
export async function autoRegisterLandlordByClaims(
  client: Queryable,
  claims: AccessTokenClaims,
  emailHint?: string
): Promise<UserRow | null> {
  const email = primaryEmailFromClaims(claims) ?? emailHint;
  if (!email?.trim()) return null;

  const normalizedEmail = normalizeEmail(email);

  // Don't auto-create if a record already exists — preserve existing state
  const existing = await findUserByEmail(client, normalizedEmail);
  if (existing) return null;

  const externalAuthOid = claims.oid ?? claims.sub;

  // Best-effort name extraction from token claims
  const firstName = normalizeNamePart(
    claims.given_name ?? (claims.name ? claims.name.split(' ')[0] : null)
  );
  const lastName = normalizeNamePart(
    claims.family_name ?? (claims.name ? claims.name.split(' ').slice(1).join(' ') : null)
  );

  const result = await client.query<UserRow>(
    `INSERT INTO users (id, external_auth_oid, email, first_name, last_name, role, status)
     OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
            INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
            INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
            INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
     VALUES (NEWID(), $1, $2, $3, $4, '${Role.LANDLORD}', 'ACTIVE')`,
    [externalAuthOid, normalizedEmail, firstName, lastName]
  );

  return result.rows[0] ?? null;
}

const LANDLORD_LIST_SELECT = `
  u.id,
  u.external_auth_oid,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.profile_photo_storage_path,
  u.role,
  u.status,
  u.tier_id,
  st.name AS tier_name,
  st.display_name AS tier_display_name,
  st.max_properties AS tier_max_properties`;

export async function listLandlords(
  client: Queryable,
  options?: { includeInactive?: boolean }
): Promise<LandlordAdminListRow[]> {
  if (options?.includeInactive) {
    const r = await client.query<LandlordAdminListRow>(
      `SELECT ${LANDLORD_LIST_SELECT}
       FROM users u
       LEFT JOIN subscription_tiers st ON st.id = u.tier_id
       WHERE u.role = '${Role.LANDLORD}'
       ORDER BY u.status DESC, u.last_name ASC, u.first_name ASC, u.email ASC`
    );
    return r.rows;
  }
  const r = await client.query<LandlordAdminListRow>(
    `SELECT ${LANDLORD_LIST_SELECT}
     FROM users u
     LEFT JOIN subscription_tiers st ON st.id = u.tier_id
     WHERE u.role = '${Role.LANDLORD}'
       AND u.status = 'ACTIVE'
     ORDER BY u.last_name ASC, u.first_name ASC, u.email ASC`
  );
  return r.rows;
}

/**
 * Admin notification test / tooling: human portal roles that can receive in-app notifications.
 * Excludes AI_AGENT and other roles.
 */
export async function listUsersForAdminNotificationRecipients(
  client: Queryable,
  options?: { includeInactive?: boolean }
): Promise<UserRow[]> {
  const roleFilter = `role IN ('${Role.ADMIN}', '${Role.LANDLORD}', '${Role.TENANT}')`;
  const orderBy = `ORDER BY role, status DESC, last_name ASC, first_name ASC, email ASC`;
  const columns = `id, external_auth_oid, email, first_name, last_name, phone, profile_photo_storage_path, role, status, ui_language, ui_color_scheme, portal_tour_completed, tier_id`;
  if (options?.includeInactive) {
    const r = await client.query<UserRow>(
      `SELECT ${columns}
       FROM users
       WHERE ${roleFilter}
       ${orderBy}`
    );
    return r.rows;
  }
  const r = await client.query<UserRow>(
    `SELECT ${columns}
     FROM users
     WHERE ${roleFilter}
       AND (status = 'ACTIVE' OR status = 'INVITED')
     ORDER BY role, last_name ASC, first_name ASC, email ASC`
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
             INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
             INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
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
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, profile_photo_storage_path, role, status, ui_language, ui_color_scheme, portal_tour_completed, tier_id
     FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

/**
 * Digits-only comparison lookup used by the inbound SMS webhook so carrier
 * keyword replies (STOP/HELP) resolve to a user even when stored formatting
 * differs (+1, hyphens, spaces, etc.).
 */
export async function findUserByPhoneDigits(
  client: Queryable,
  digitsOnlyPhone: string
): Promise<UserRow | null> {
  const digits = String(digitsOnlyPhone ?? '').replace(/\D+/g, '');
  if (!digits) return null;
  const r = await client.query<UserRow>(
    `SELECT id, external_auth_oid, email, first_name, last_name, phone, profile_photo_storage_path, role, status, ui_language, ui_color_scheme, portal_tour_completed, tier_id
     FROM users
     WHERE phone IS NOT NULL
       AND LEN(phone) > 0
       AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), '.', '') = $1`,
    [digits]
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

export type AdminNotificationRecipientRow = {
  user_id: string;
  email: string | null;
  phone: string | null;
  role: string;
};

/**
 * Active portal admins eligible for operational / security alerts.
 */
export async function listActiveAdminNotificationRecipients(
  client: Queryable
): Promise<AdminNotificationRecipientRow[]> {
  const r = await client.query<AdminNotificationRecipientRow>(
    `SELECT id AS user_id, email, phone, role
     FROM users
     WHERE UPPER(role) = '${Role.ADMIN}'
       AND UPPER(status) IN ('ACTIVE', 'INVITED')`
  );
  return r.rows;
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
             INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
             INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
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
            INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
            INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id;`,
    [sub, email, firstName, lastName, role]
  );
  return r.rows[0]!;
}

const ALLOWED_LANGUAGES = new Set(['en', 'es', 'fr', 'ar']);
const ALLOWED_COLOR_SCHEMES = new Set(['light', 'dark']);

/**
 * Persists UI language, color-scheme, and/or portal tour completion for a user.
 * Only fields that are explicitly provided (non-undefined) are written.
 * Invalid / unrecognised values are stored as NULL so the client falls back
 * to its local default rather than applying a bad value.
 */
export async function updateUserUiPreferences(
  client: Queryable,
  userId: string,
  prefs: {
    uiLanguage?: string | null;
    uiColorScheme?: string | null;
    portalTourCompleted?: boolean;
  }
): Promise<UserRow | null> {
  const hasLanguage = Object.prototype.hasOwnProperty.call(prefs, 'uiLanguage');
  const hasColorScheme = Object.prototype.hasOwnProperty.call(prefs, 'uiColorScheme');
  const hasPortalTourCompleted = Object.prototype.hasOwnProperty.call(prefs, 'portalTourCompleted');
  if (!hasLanguage && !hasColorScheme && !hasPortalTourCompleted) {
    return findUserById(client, userId);
  }

  const langValue = hasLanguage
    ? (prefs.uiLanguage && ALLOWED_LANGUAGES.has(prefs.uiLanguage) ? prefs.uiLanguage : null)
    : undefined;
  const schemeValue = hasColorScheme
    ? (prefs.uiColorScheme && ALLOWED_COLOR_SCHEMES.has(prefs.uiColorScheme) ? prefs.uiColorScheme : null)
    : undefined;
  const tourDone =
    hasPortalTourCompleted && typeof prefs.portalTourCompleted === 'boolean'
      ? prefs.portalTourCompleted
      : undefined;

  const setClauses: string[] = [];
  const params: unknown[] = [userId];
  if (langValue !== undefined) {
    params.push(langValue);
    setClauses.push(`ui_language = $${params.length}`);
  }
  if (schemeValue !== undefined) {
    params.push(schemeValue);
    setClauses.push(`ui_color_scheme = $${params.length}`);
  }
  if (tourDone !== undefined) {
    params.push(tourDone ? 1 : 0);
    setClauses.push(`portal_tour_completed = $${params.length}`);
  }

  if (setClauses.length === 0) {
    return findUserById(client, userId);
  }

  const r = await client.query<UserRow>(
    `UPDATE users
        SET ${setClauses.join(', ')}, updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
             INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
             INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
             INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
      WHERE id = $1`,
    params
  );
  return r.rows[0] ?? null;
}

export async function updateUserProfilePhotoPath(
  client: Queryable,
  userId: string,
  storagePath: string | null
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `UPDATE users
        SET profile_photo_storage_path = $2,
            updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
             INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
             INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
             INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
      WHERE id = $1`,
    [userId, storagePath]
  );
  return r.rows[0] ?? null;
}

export async function setUserTier(
  client: Queryable,
  userId: string,
  tierId: string | null
): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `UPDATE users
        SET tier_id    = $2,
            updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.external_auth_oid, INSERTED.email,
             INSERTED.first_name, INSERTED.last_name, INSERTED.phone,
             INSERTED.profile_photo_storage_path, INSERTED.role, INSERTED.status,
             INSERTED.ui_language, INSERTED.ui_color_scheme, INSERTED.portal_tour_completed, INSERTED.tier_id
      WHERE id = $1`,
    [userId, tierId]
  );
  return r.rows[0] ?? null;
}

/**
 * Assigns the FREE tier to a user only when they don't already have one.
 * Idempotent — safe to call on every login.
 */
export async function autoAssignFreeTier(
  client: Queryable,
  userId: string,
  freeTierId: string
): Promise<void> {
  await client.query(
    `UPDATE users SET tier_id = $2, updated_at = GETUTCDATE()
     WHERE id = $1 AND tier_id IS NULL`,
    [userId, freeTierId]
  );
}
