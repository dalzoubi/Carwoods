/**
 * Repo for tenant-lifecycle tables: move-outs, evictions, notices + co-signs,
 * landlord/tenant re-rent blocks, and per-landlord portal-access grace.
 *
 * No business rules live here — each function is a typed CRUD wrapper. Policies
 * (who can do what, how ACTIVE/ENDED flip, what ends a grace window) live in
 * the use case layer.
 */

import type { PoolClient, QueryResult } from './db.js';

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

// ---------------------------------------------------------------------------
// lease_move_outs
// ---------------------------------------------------------------------------

export type ForwardingAddress = {
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
};

export type LeaseMoveOutRow = {
  lease_id: string;
  forwarding_street: string | null;
  forwarding_street2: string | null;
  forwarding_city: string | null;
  forwarding_state: string | null;
  forwarding_zip: string | null;
  forwarding_country: string | null;
  final_balance_amount: number | null;
  inspection_notes: string | null;
  internal_notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
};

export type UpsertMoveOutInput = {
  leaseId: string;
  forwarding?: Partial<ForwardingAddress> | null;
  finalBalanceAmount?: number | null;
  inspectionNotes?: string | null;
  internalNotes?: string | null;
  actorUserId: string;
};

const MOVE_OUT_COLS = `lease_id,
       forwarding_street, forwarding_street2, forwarding_city, forwarding_state,
       forwarding_zip, forwarding_country,
       final_balance_amount, inspection_notes, internal_notes,
       created_at, updated_at, created_by, updated_by`;

export async function getMoveOutForLease(
  client: Queryable,
  leaseId: string
): Promise<LeaseMoveOutRow | null> {
  const r = await client.query<LeaseMoveOutRow>(
    `SELECT ${MOVE_OUT_COLS} FROM lease_move_outs WHERE lease_id = $1`,
    [leaseId]
  );
  return r.rows[0] ?? null;
}

/** Insert or update the move-out detail for a lease (1:1). */
export async function upsertMoveOut(
  client: PoolClient,
  input: UpsertMoveOutInput
): Promise<LeaseMoveOutRow> {
  const fwd = input.forwarding ?? {};
  const values = [
    input.leaseId,
    fwd.street ?? null,
    fwd.street2 ?? null,
    fwd.city ?? null,
    fwd.state ?? null,
    fwd.zip ?? null,
    fwd.country ?? null,
    input.finalBalanceAmount ?? null,
    input.inspectionNotes ?? null,
    input.internalNotes ?? null,
    input.actorUserId,
  ];

  await client.query(
    `MERGE lease_move_outs AS tgt
     USING (SELECT $1 AS lease_id) AS src ON tgt.lease_id = src.lease_id
     WHEN MATCHED THEN UPDATE SET
       forwarding_street   = $2,
       forwarding_street2  = $3,
       forwarding_city     = $4,
       forwarding_state    = $5,
       forwarding_zip      = $6,
       forwarding_country  = $7,
       final_balance_amount = $8,
       inspection_notes    = $9,
       internal_notes      = $10,
       updated_by          = $11,
       updated_at          = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN INSERT
       (lease_id, forwarding_street, forwarding_street2, forwarding_city, forwarding_state,
        forwarding_zip, forwarding_country, final_balance_amount, inspection_notes,
        internal_notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11);`,
    values
  );
  const row = await getMoveOutForLease(client, input.leaseId);
  if (!row) throw new Error('move_out_upsert_failed');
  return row;
}

export async function deleteMoveOut(client: PoolClient, leaseId: string): Promise<boolean> {
  const r = await client.query(
    `DELETE FROM lease_move_outs WHERE lease_id = $1`,
    [leaseId]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Update just the forwarding address on an existing move-out row (or create a sparse row
 * if none exists yet — tenant can fill this during the grace window).
 */
export async function setMoveOutForwardingAddress(
  client: PoolClient,
  leaseId: string,
  forwarding: Partial<ForwardingAddress>,
  actorUserId: string
): Promise<LeaseMoveOutRow> {
  return upsertMoveOut(client, {
    leaseId,
    forwarding,
    actorUserId,
  });
}

// ---------------------------------------------------------------------------
// lease_evictions
// ---------------------------------------------------------------------------

export type LeaseEvictionRow = {
  lease_id: string;
  case_number: string | null;
  notice_served_on: string | null;
  judgment_date: string | null;
  judgment_amount: number | null;
  collections_forwarded: boolean;
  details: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
};

export type UpsertEvictionInput = {
  leaseId: string;
  caseNumber?: string | null;
  noticeServedOn?: string | null;
  judgmentDate?: string | null;
  judgmentAmount?: number | null;
  collectionsForwarded?: boolean;
  details?: string | null;
  actorUserId: string;
};

const EVICTION_COLS = `lease_id, case_number,
       CONVERT(NVARCHAR(10), notice_served_on, 23) AS notice_served_on,
       CONVERT(NVARCHAR(10), judgment_date, 23)    AS judgment_date,
       judgment_amount, collections_forwarded, details,
       created_at, updated_at, created_by, updated_by`;

export async function getEvictionForLease(
  client: Queryable,
  leaseId: string
): Promise<LeaseEvictionRow | null> {
  const r = await client.query<LeaseEvictionRow>(
    `SELECT ${EVICTION_COLS} FROM lease_evictions WHERE lease_id = $1`,
    [leaseId]
  );
  return r.rows[0] ?? null;
}

export async function upsertEviction(
  client: PoolClient,
  input: UpsertEvictionInput
): Promise<LeaseEvictionRow> {
  const values = [
    input.leaseId,
    input.caseNumber ?? null,
    input.noticeServedOn ?? null,
    input.judgmentDate ?? null,
    input.judgmentAmount ?? null,
    input.collectionsForwarded ? 1 : 0,
    input.details ?? null,
    input.actorUserId,
  ];
  await client.query(
    `MERGE lease_evictions AS tgt
     USING (SELECT $1 AS lease_id) AS src ON tgt.lease_id = src.lease_id
     WHEN MATCHED THEN UPDATE SET
       case_number           = $2,
       notice_served_on      = $3,
       judgment_date         = $4,
       judgment_amount       = $5,
       collections_forwarded = $6,
       details               = $7,
       updated_by            = $8,
       updated_at            = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN INSERT
       (lease_id, case_number, notice_served_on, judgment_date, judgment_amount,
        collections_forwarded, details, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8);`,
    values
  );
  const row = await getEvictionForLease(client, input.leaseId);
  if (!row) throw new Error('eviction_upsert_failed');
  return row;
}

export async function deleteEviction(client: PoolClient, leaseId: string): Promise<boolean> {
  const r = await client.query(`DELETE FROM lease_evictions WHERE lease_id = $1`, [leaseId]);
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// lease_notices + co-signs
// ---------------------------------------------------------------------------

export type NoticeStatus =
  | 'pending_co_signers'
  | 'pending_landlord'
  | 'pending_tenant'
  | 'accepted'
  | 'withdrawn'
  | 'rejected'
  | 'superseded';

export type NoticeScope = 'all_tenants' | 'self_only';

export type NoticeReason = 'relocating' | 'job' | 'purchase' | 'early_termination' | 'other';

export type LeaseNoticeRow = {
  id: string;
  lease_id: string;
  given_by_user_id: string;
  given_on: string;
  planned_move_out_date: string;
  reason: NoticeReason | null;
  reason_notes: string | null;
  scope: NoticeScope;
  early_termination: boolean;
  status: NoticeStatus;
  counter_proposed_date: string | null;
  counter_proposed_notes: string | null;
  counter_proposed_at: Date | null;
  counter_proposed_by: string | null;
  responded_at: Date | null;
  responded_by: string | null;
  withdrawn_at: Date | null;
  withdrawn_by: string | null;
  landlord_notes: string | null;
  forwarding_street: string | null;
  forwarding_street2: string | null;
  forwarding_city: string | null;
  forwarding_state: string | null;
  forwarding_zip: string | null;
  forwarding_country: string | null;
  created_at: Date;
  updated_at: Date;
};

const NOTICE_COLS = `id, lease_id, given_by_user_id,
       CONVERT(NVARCHAR(10), given_on, 23)              AS given_on,
       CONVERT(NVARCHAR(10), planned_move_out_date, 23) AS planned_move_out_date,
       reason, reason_notes, scope, early_termination, status,
       CONVERT(NVARCHAR(10), counter_proposed_date, 23) AS counter_proposed_date,
       counter_proposed_notes, counter_proposed_at, counter_proposed_by,
       responded_at, responded_by, withdrawn_at, withdrawn_by, landlord_notes,
       forwarding_street, forwarding_street2, forwarding_city, forwarding_state,
       forwarding_zip, forwarding_country,
       created_at, updated_at`;

export async function getNoticeById(
  client: Queryable,
  noticeId: string
): Promise<LeaseNoticeRow | null> {
  const r = await client.query<LeaseNoticeRow>(
    `SELECT ${NOTICE_COLS} FROM lease_notices WHERE id = $1`,
    [noticeId]
  );
  return r.rows[0] ?? null;
}

/** Live notice on a lease (status NOT IN withdrawn/rejected/superseded). At most one. */
export async function getLiveNoticeForLease(
  client: Queryable,
  leaseId: string
): Promise<LeaseNoticeRow | null> {
  const r = await client.query<LeaseNoticeRow>(
    `SELECT TOP 1 ${NOTICE_COLS}
     FROM lease_notices
     WHERE lease_id = $1
       AND status NOT IN ('withdrawn', 'rejected', 'superseded')
     ORDER BY created_at DESC`,
    [leaseId]
  );
  return r.rows[0] ?? null;
}

export type LandlordNoticeRow = LeaseNoticeRow & {
  property_id: string;
  property_street: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
};

/**
 * Lists every live notice on leases whose property is owned by the given actor,
 * or every live notice system-wide when the actor is an ADMIN.
 */
export async function listLiveNoticesForLandlord(
  client: Queryable,
  actorRole: string,
  actorUserId: string
): Promise<LandlordNoticeRow[]> {
  const role = actorRole.trim().toUpperCase();
  const r = await client.query<LandlordNoticeRow>(
    `SELECT n.id, n.lease_id, n.given_by_user_id,
            CONVERT(NVARCHAR(10), n.given_on, 23)              AS given_on,
            CONVERT(NVARCHAR(10), n.planned_move_out_date, 23) AS planned_move_out_date,
            n.reason, n.reason_notes, n.scope, n.early_termination, n.status,
            CONVERT(NVARCHAR(10), n.counter_proposed_date, 23) AS counter_proposed_date,
            n.counter_proposed_notes, n.counter_proposed_at, n.counter_proposed_by,
            n.responded_at, n.responded_by, n.withdrawn_at, n.withdrawn_by, n.landlord_notes,
            n.forwarding_street, n.forwarding_street2, n.forwarding_city, n.forwarding_state,
            n.forwarding_zip, n.forwarding_country,
            n.created_at, n.updated_at,
            p.id AS property_id,
            p.street AS property_street, p.city AS property_city,
            p.state AS property_state, p.zip AS property_zip
     FROM lease_notices n
     JOIN leases l     ON l.id = n.lease_id AND l.deleted_at IS NULL
     JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
     WHERE n.status NOT IN ('withdrawn', 'rejected', 'superseded', 'accepted')
       AND ($1 = 'ADMIN' OR p.created_by = $2)
     ORDER BY n.created_at DESC`,
    [role, actorUserId]
  );
  return r.rows;
}

/**
 * Count of notices that still need the landlord's explicit response.
 * TENANT counts co-sign slots pending on them + notices where it's their turn
 * (status=pending_tenant after a landlord counter-proposal).
 */
export async function countActionableNoticesForActor(
  client: Queryable,
  actorRole: string,
  actorUserId: string
): Promise<number> {
  const role = actorRole.trim().toUpperCase();
  if (role === 'LANDLORD' || role === 'ADMIN') {
    const r = await client.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt
       FROM lease_notices n
       JOIN leases l     ON l.id = n.lease_id AND l.deleted_at IS NULL
       JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
       WHERE n.status = 'pending_landlord'
         AND ($1 = 'ADMIN' OR p.created_by = $2)`,
      [role, actorUserId]
    );
    return Number(r.rows[0]?.cnt ?? 0);
  }
  if (role === 'TENANT') {
    const r = await client.query<{ cnt: number }>(
      `SELECT
          (SELECT COUNT(*)
             FROM notice_co_signs cs
             JOIN lease_notices n ON n.id = cs.notice_id
            WHERE cs.tenant_user_id = $1
              AND cs.signed_at IS NULL
              AND n.status = 'pending_co_signers') +
          (SELECT COUNT(*)
             FROM lease_notices n
             JOIN lease_tenants lt ON lt.lease_id = n.lease_id AND lt.user_id = $1
            WHERE n.status = 'pending_tenant') AS cnt`,
      [actorUserId]
    );
    return Number(r.rows[0]?.cnt ?? 0);
  }
  return 0;
}

export async function listNoticesForLease(
  client: Queryable,
  leaseId: string
): Promise<LeaseNoticeRow[]> {
  const r = await client.query<LeaseNoticeRow>(
    `SELECT ${NOTICE_COLS} FROM lease_notices WHERE lease_id = $1 ORDER BY created_at DESC`,
    [leaseId]
  );
  return r.rows;
}

export type InsertNoticeInput = {
  leaseId: string;
  givenByUserId: string;
  givenOn: string;
  plannedMoveOutDate: string;
  reason?: NoticeReason | null;
  reasonNotes?: string | null;
  scope: NoticeScope;
  earlyTermination: boolean;
  status: NoticeStatus;
  forwarding?: Partial<ForwardingAddress> | null;
};

export async function insertNotice(
  client: PoolClient,
  input: InsertNoticeInput
): Promise<LeaseNoticeRow> {
  const fwd = input.forwarding ?? {};
  const r = await client.query<LeaseNoticeRow>(
    `INSERT INTO lease_notices (
       id, lease_id, given_by_user_id, given_on, planned_move_out_date,
       reason, reason_notes, scope, early_termination, status,
       forwarding_street, forwarding_street2, forwarding_city, forwarding_state,
       forwarding_zip, forwarding_country
     )
     OUTPUT INSERTED.id, INSERTED.lease_id, INSERTED.given_by_user_id,
            CONVERT(NVARCHAR(10), INSERTED.given_on, 23)              AS given_on,
            CONVERT(NVARCHAR(10), INSERTED.planned_move_out_date, 23) AS planned_move_out_date,
            INSERTED.reason, INSERTED.reason_notes, INSERTED.scope,
            INSERTED.early_termination, INSERTED.status,
            CONVERT(NVARCHAR(10), INSERTED.counter_proposed_date, 23) AS counter_proposed_date,
            INSERTED.counter_proposed_notes, INSERTED.counter_proposed_at,
            INSERTED.counter_proposed_by, INSERTED.responded_at, INSERTED.responded_by,
            INSERTED.withdrawn_at, INSERTED.withdrawn_by, INSERTED.landlord_notes,
            INSERTED.forwarding_street, INSERTED.forwarding_street2, INSERTED.forwarding_city,
            INSERTED.forwarding_state, INSERTED.forwarding_zip, INSERTED.forwarding_country,
            INSERTED.created_at, INSERTED.updated_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      input.leaseId,
      input.givenByUserId,
      input.givenOn,
      input.plannedMoveOutDate,
      input.reason ?? null,
      input.reasonNotes ?? null,
      input.scope,
      input.earlyTermination ? 1 : 0,
      input.status,
      fwd.street ?? null,
      fwd.street2 ?? null,
      fwd.city ?? null,
      fwd.state ?? null,
      fwd.zip ?? null,
      fwd.country ?? null,
    ]
  );
  return r.rows[0]!;
}

export async function setNoticeStatus(
  client: PoolClient,
  noticeId: string,
  status: NoticeStatus,
  actorUserId: string | null
): Promise<LeaseNoticeRow | null> {
  const r = await client.query<LeaseNoticeRow>(
    `UPDATE lease_notices SET
       status       = $2,
       responded_at = CASE WHEN $2 IN ('accepted','rejected') THEN SYSDATETIMEOFFSET() ELSE responded_at END,
       responded_by = CASE WHEN $2 IN ('accepted','rejected') THEN $3 ELSE responded_by END,
       withdrawn_at = CASE WHEN $2 = 'withdrawn' THEN SYSDATETIMEOFFSET() ELSE withdrawn_at END,
       withdrawn_by = CASE WHEN $2 = 'withdrawn' THEN $3 ELSE withdrawn_by END,
       updated_at   = SYSDATETIMEOFFSET()
     WHERE id = $1`,
    [noticeId, status, actorUserId]
  );
  if ((r.rowCount ?? 0) === 0) return null;
  return getNoticeById(client, noticeId);
}

export async function setNoticeCounterProposal(
  client: PoolClient,
  input: {
    noticeId: string;
    counterDate: string;
    counterNotes: string | null;
    actorUserId: string;
  }
): Promise<LeaseNoticeRow | null> {
  await client.query(
    `UPDATE lease_notices SET
       status                 = 'pending_tenant',
       counter_proposed_date  = $2,
       counter_proposed_notes = $3,
       counter_proposed_at    = SYSDATETIMEOFFSET(),
       counter_proposed_by    = $4,
       updated_at             = SYSDATETIMEOFFSET()
     WHERE id = $1`,
    [input.noticeId, input.counterDate, input.counterNotes, input.actorUserId]
  );
  return getNoticeById(client, input.noticeId);
}

export async function setNoticeForwardingAddress(
  client: PoolClient,
  noticeId: string,
  forwarding: Partial<ForwardingAddress>
): Promise<LeaseNoticeRow | null> {
  await client.query(
    `UPDATE lease_notices SET
       forwarding_street   = $2,
       forwarding_street2  = $3,
       forwarding_city     = $4,
       forwarding_state    = $5,
       forwarding_zip      = $6,
       forwarding_country  = $7,
       updated_at          = SYSDATETIMEOFFSET()
     WHERE id = $1`,
    [
      noticeId,
      forwarding.street ?? null,
      forwarding.street2 ?? null,
      forwarding.city ?? null,
      forwarding.state ?? null,
      forwarding.zip ?? null,
      forwarding.country ?? null,
    ]
  );
  return getNoticeById(client, noticeId);
}

// --- co-signs ---

export type LeaseNoticeCoSignRow = {
  id: string;
  notice_id: string;
  tenant_user_id: string;
  signed_at: Date | null;
  created_at: Date;
};

export async function insertCoSignRows(
  client: PoolClient,
  noticeId: string,
  tenantUserIds: string[]
): Promise<void> {
  if (tenantUserIds.length === 0) return;
  for (const tid of tenantUserIds) {
    await client.query(
      `INSERT INTO lease_notice_co_signs (id, notice_id, tenant_user_id)
       VALUES (NEWID(), $1, $2)`,
      [noticeId, tid]
    );
  }
}

export async function listCoSignsForNotice(
  client: Queryable,
  noticeId: string
): Promise<LeaseNoticeCoSignRow[]> {
  const r = await client.query<LeaseNoticeCoSignRow>(
    `SELECT id, notice_id, tenant_user_id, signed_at, created_at
     FROM lease_notice_co_signs
     WHERE notice_id = $1
     ORDER BY created_at`,
    [noticeId]
  );
  return r.rows;
}

/** Mark a co-sign row signed. Returns true if the row existed and was not already signed. */
export async function signCoSign(
  client: PoolClient,
  noticeId: string,
  tenantUserId: string
): Promise<boolean> {
  const r = await client.query(
    `UPDATE lease_notice_co_signs
        SET signed_at = SYSDATETIMEOFFSET()
      WHERE notice_id = $1 AND tenant_user_id = $2 AND signed_at IS NULL`,
    [noticeId, tenantUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function countUnsignedCoSigns(
  client: Queryable,
  noticeId: string
): Promise<number> {
  const r = await client.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM lease_notice_co_signs
     WHERE notice_id = $1 AND signed_at IS NULL`,
    [noticeId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// landlord_tenant_blocks
// ---------------------------------------------------------------------------

export type LandlordTenantBlockRow = {
  id: string;
  landlord_user_id: string;
  tenant_user_id: string;
  source_lease_id: string | null;
  reason: 'eviction' | 'manual';
  notes: string | null;
  created_at: Date;
  created_by: string | null;
  overridden_at: Date | null;
  overridden_by: string | null;
  override_notes: string | null;
};

const BLOCK_COLS = `id, landlord_user_id, tenant_user_id, source_lease_id, reason, notes,
       created_at, created_by, overridden_at, overridden_by, override_notes`;

const BLOCK_INSERTED_COLS = `INSERTED.id, INSERTED.landlord_user_id, INSERTED.tenant_user_id,
       INSERTED.source_lease_id, INSERTED.reason, INSERTED.notes,
       INSERTED.created_at, INSERTED.created_by,
       INSERTED.overridden_at, INSERTED.overridden_by, INSERTED.override_notes`;

export async function insertRerentBlock(
  client: PoolClient,
  input: {
    landlordUserId: string;
    tenantUserId: string;
    sourceLeaseId: string | null;
    reason?: 'eviction' | 'manual';
    notes?: string | null;
    actorUserId: string;
  }
): Promise<LandlordTenantBlockRow> {
  const r = await client.query<LandlordTenantBlockRow>(
    `INSERT INTO landlord_tenant_blocks
       (id, landlord_user_id, tenant_user_id, source_lease_id, reason, notes, created_by)
     OUTPUT ${BLOCK_INSERTED_COLS}
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6)`,
    [
      input.landlordUserId,
      input.tenantUserId,
      input.sourceLeaseId,
      input.reason ?? 'eviction',
      input.notes ?? null,
      input.actorUserId,
    ]
  );
  return r.rows[0]!;
}

/** Any active (not overridden) block between this landlord and tenant. */
export async function getActiveRerentBlock(
  client: Queryable,
  landlordUserId: string,
  tenantUserId: string
): Promise<LandlordTenantBlockRow | null> {
  const r = await client.query<LandlordTenantBlockRow>(
    `SELECT TOP 1 ${BLOCK_COLS}
     FROM landlord_tenant_blocks
     WHERE landlord_user_id = $1 AND tenant_user_id = $2 AND overridden_at IS NULL
     ORDER BY created_at DESC`,
    [landlordUserId, tenantUserId]
  );
  return r.rows[0] ?? null;
}

export async function overrideRerentBlock(
  client: PoolClient,
  blockId: string,
  actorUserId: string,
  overrideNotes: string | null
): Promise<LandlordTenantBlockRow | null> {
  const r = await client.query<LandlordTenantBlockRow>(
    `UPDATE landlord_tenant_blocks
        SET overridden_at  = SYSDATETIMEOFFSET(),
            overridden_by  = $2,
            override_notes = $3
      OUTPUT ${BLOCK_INSERTED_COLS}
      WHERE id = $1 AND overridden_at IS NULL`,
    [blockId, actorUserId, overrideNotes]
  );
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// tenant_portal_access
// ---------------------------------------------------------------------------

export type PortalAccessLevel = 'READ_ONLY' | 'REVOKED';
export type PortalAccessReason = 'move_out' | 'eviction' | 'early_termination' | 'manual';

export type TenantPortalAccessRow = {
  id: string;
  tenant_user_id: string;
  landlord_user_id: string;
  source_lease_id: string | null;
  access_level: PortalAccessLevel;
  effective_until: Date | null;
  reason: PortalAccessReason;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
};

const PORTAL_ACCESS_COLS = `id, tenant_user_id, landlord_user_id, source_lease_id,
       access_level, effective_until, reason,
       created_at, updated_at, created_by, updated_by`;

export async function upsertPortalAccess(
  client: PoolClient,
  input: {
    tenantUserId: string;
    landlordUserId: string;
    sourceLeaseId: string | null;
    accessLevel: PortalAccessLevel;
    /** ISO datetimeoffset; null for REVOKED. */
    effectiveUntil: string | null;
    reason: PortalAccessReason;
    actorUserId: string;
  }
): Promise<TenantPortalAccessRow> {
  await client.query(
    `MERGE tenant_portal_access AS tgt
     USING (SELECT $1 AS tenant_user_id, $2 AS landlord_user_id) AS src
       ON tgt.tenant_user_id = src.tenant_user_id AND tgt.landlord_user_id = src.landlord_user_id
     WHEN MATCHED THEN UPDATE SET
       source_lease_id  = $3,
       access_level     = $4,
       effective_until  = $5,
       reason           = $6,
       updated_by       = $7,
       updated_at       = SYSDATETIMEOFFSET()
     WHEN NOT MATCHED THEN INSERT
       (id, tenant_user_id, landlord_user_id, source_lease_id, access_level,
        effective_until, reason, created_by, updated_by)
       VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7, $7);`,
    [
      input.tenantUserId,
      input.landlordUserId,
      input.sourceLeaseId,
      input.accessLevel,
      input.effectiveUntil,
      input.reason,
      input.actorUserId,
    ]
  );
  const row = await getPortalAccess(client, input.tenantUserId, input.landlordUserId);
  if (!row) throw new Error('portal_access_upsert_failed');
  return row;
}

export async function getPortalAccess(
  client: Queryable,
  tenantUserId: string,
  landlordUserId: string
): Promise<TenantPortalAccessRow | null> {
  const r = await client.query<TenantPortalAccessRow>(
    `SELECT ${PORTAL_ACCESS_COLS} FROM tenant_portal_access
     WHERE tenant_user_id = $1 AND landlord_user_id = $2`,
    [tenantUserId, landlordUserId]
  );
  return r.rows[0] ?? null;
}

export async function listPortalAccessForTenant(
  client: Queryable,
  tenantUserId: string
): Promise<TenantPortalAccessRow[]> {
  const r = await client.query<TenantPortalAccessRow>(
    `SELECT ${PORTAL_ACCESS_COLS} FROM tenant_portal_access WHERE tenant_user_id = $1`,
    [tenantUserId]
  );
  return r.rows;
}

/**
 * Flip READ_ONLY rows whose effective_until has passed to REVOKED. Returns the rows
 * that were updated so callers can audit/log the transitions.
 */
export async function expireReadOnlyGraceWindows(
  client: PoolClient,
  now: Date = new Date()
): Promise<TenantPortalAccessRow[]> {
  const r = await client.query<TenantPortalAccessRow>(
    `UPDATE tenant_portal_access
        SET access_level    = 'REVOKED',
            effective_until = NULL,
            updated_at      = SYSDATETIMEOFFSET()
      OUTPUT INSERTED.id, INSERTED.tenant_user_id, INSERTED.landlord_user_id,
             INSERTED.source_lease_id, INSERTED.access_level, INSERTED.effective_until,
             INSERTED.reason, INSERTED.created_at, INSERTED.updated_at,
             INSERTED.created_by, INSERTED.updated_by
      WHERE access_level = 'READ_ONLY' AND effective_until IS NOT NULL AND effective_until <= $1`,
    [now]
  );
  return r.rows;
}

/** Clear a per-landlord access row entirely (used on undo / re-rent to the same landlord). */
export async function deletePortalAccess(
  client: PoolClient,
  tenantUserId: string,
  landlordUserId: string
): Promise<boolean> {
  const r = await client.query(
    `DELETE FROM tenant_portal_access
     WHERE tenant_user_id = $1 AND landlord_user_id = $2`,
    [tenantUserId, landlordUserId]
  );
  return (r.rowCount ?? 0) > 0;
}
