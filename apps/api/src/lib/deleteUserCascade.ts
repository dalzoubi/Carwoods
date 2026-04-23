/**
 * Admin hard-delete for a user plus everything they created.
 *
 * The schema has many ON DELETE NO ACTION foreign keys pointing at users and
 * properties (to keep audit trails coherent during normal operation). To
 * genuinely remove a landlord we have to cascade manually through every
 * owning table before deleting the user row.
 *
 * A transaction wraps the whole thing so a partial failure rolls back
 * cleanly. Audit rows are written BEFORE the user row is deleted so the
 * actor FK remains valid; the entity_id (the user being deleted) is plain
 * GUID text, not an FK, so it survives the row disappearing.
 */

import type { PoolClient } from './db.js';
import { writeAudit } from './auditRepo.js';
import type { UserRow } from './usersRepo.js';

type Pool = {
  connect(): Promise<PoolClient>;
};

export type DeleteUserSummary = {
  userId: string;
  propertyCount: number;
  leaseCount: number;
  maintenanceRequestCount: number;
  documentCount: number;
  supportTicketCount: number;
  /** lease_tenants rows where this user is the tenant */
  leaseTenancyCount: number;
  /** maintenance_requests where this user is the submitter (any property) */
  maintenanceRequestSubmittedCount: number;
};

type SqlQueryable = {
  query: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

export function emptyUserAssociationSummary(userId: string): DeleteUserSummary {
  return {
    userId,
    propertyCount: 0,
    leaseCount: 0,
    maintenanceRequestCount: 0,
    documentCount: 0,
    supportTicketCount: 0,
    leaseTenancyCount: 0,
    maintenanceRequestSubmittedCount: 0,
  };
}

async function countOwnedResources(
  client: PoolClient,
  userId: string
): Promise<DeleteUserSummary> {
  const rows = await client.query<{
    property_count: number;
    lease_count: number;
    request_count: number;
    document_count: number;
    ticket_count: number;
    lease_tenancy_count: number;
    request_submitted_count: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM properties WHERE created_by = $1) AS property_count,
       (SELECT COUNT(*) FROM leases l
         JOIN properties p ON p.id = l.property_id
         WHERE p.created_by = $1) AS lease_count,
       (SELECT COUNT(*) FROM maintenance_requests mr
         JOIN properties p ON p.id = mr.property_id
         WHERE p.created_by = $1) AS request_count,
       (SELECT COUNT(*) FROM documents d WHERE d.landlord_id = $1) AS document_count,
       (SELECT COUNT(*) FROM support_tickets st WHERE st.user_id = $1) AS ticket_count,
       (SELECT COUNT(*) FROM lease_tenants lt WHERE lt.user_id = $1) AS lease_tenancy_count,
       (SELECT COUNT(*) FROM maintenance_requests mr2 WHERE mr2.submitted_by_user_id = $1) AS request_submitted_count`,
    [userId]
  );
  const row = rows.rows[0] ?? {
    property_count: 0,
    lease_count: 0,
    request_count: 0,
    document_count: 0,
    ticket_count: 0,
    lease_tenancy_count: 0,
    request_submitted_count: 0,
  };
  return {
    userId,
    propertyCount: Number(row.property_count ?? 0),
    leaseCount: Number(row.lease_count ?? 0),
    maintenanceRequestCount: Number(row.request_count ?? 0),
    documentCount: Number(row.document_count ?? 0),
    supportTicketCount: Number(row.ticket_count ?? 0),
    leaseTenancyCount: Number(row.lease_tenancy_count ?? 0),
    maintenanceRequestSubmittedCount: Number(row.request_submitted_count ?? 0),
  };
}

/**
 * Batch version of countOwnedResources for the admin user list. One query per
 * metric, each grouped by the relevant user id column, merged into 0 for ids
 * with no rows.
 */
export async function batchCountUserAccountAssociations(
  pool: SqlQueryable,
  userIds: string[]
): Promise<Map<string, DeleteUserSummary>> {
  const byId = new Map<string, DeleteUserSummary>();
  for (const id of userIds) {
    byId.set(id, emptyUserAssociationSummary(id));
  }
  if (userIds.length === 0) return byId;

  const ph = userIds.map((_, i) => `$${i + 1}`).join(',');
  const p = userIds;

  const apply = (rows: { user_id: unknown; c: unknown }[], field: keyof Omit<DeleteUserSummary, 'userId'>) => {
    for (const r of rows) {
      const id = String(r.user_id);
      const entry = byId.get(id) ?? emptyUserAssociationSummary(id);
      const n = Number(r.c ?? 0);
      if (field === 'propertyCount') entry.propertyCount = n;
      else if (field === 'leaseCount') entry.leaseCount = n;
      else if (field === 'maintenanceRequestCount') entry.maintenanceRequestCount = n;
      else if (field === 'documentCount') entry.documentCount = n;
      else if (field === 'supportTicketCount') entry.supportTicketCount = n;
      else if (field === 'leaseTenancyCount') entry.leaseTenancyCount = n;
      else if (field === 'maintenanceRequestSubmittedCount') entry.maintenanceRequestSubmittedCount = n;
      byId.set(id, entry);
    }
  };

  const [
    propsR,
    leaseR,
    reqR,
    docR,
    ticketR,
    tenancyR,
    submittedR,
  ] = await Promise.all([
    pool.query<{ user_id: string; c: number }>(
      `SELECT created_by AS user_id, COUNT(*) AS c
       FROM properties
       WHERE created_by IN (${ph})
       GROUP BY created_by`,
      p
    ),
    pool.query<{ user_id: string; c: number }>(
      `SELECT p.created_by AS user_id, COUNT(*) AS c
       FROM leases l
       INNER JOIN properties p ON p.id = l.property_id
       WHERE p.created_by IN (${ph})
       GROUP BY p.created_by`,
      p
    ),
    pool.query<{ user_id: string; c: number }>(
      `SELECT p.created_by AS user_id, COUNT(*) AS c
       FROM maintenance_requests mr
       INNER JOIN properties p ON p.id = mr.property_id
       WHERE p.created_by IN (${ph})
       GROUP BY p.created_by`,
      p
    ),
    pool.query<{ user_id: string; c: number }>(
      `SELECT landlord_id AS user_id, COUNT(*) AS c
       FROM documents
       WHERE landlord_id IN (${ph})
       GROUP BY landlord_id`,
      p
    ),
    pool.query<{ user_id: string; c: number }>(
      `SELECT user_id, COUNT(*) AS c
       FROM support_tickets
       WHERE user_id IN (${ph})
       GROUP BY user_id`,
      p
    ),
    pool.query<{ user_id: string; c: number }>(
      `SELECT user_id, COUNT(*) AS c
       FROM lease_tenants
       WHERE user_id IN (${ph})
       GROUP BY user_id`,
      p
    ),
    pool.query<{ user_id: string; c: number }>(
      `SELECT submitted_by_user_id AS user_id, COUNT(*) AS c
       FROM maintenance_requests
       WHERE submitted_by_user_id IN (${ph})
       GROUP BY submitted_by_user_id`,
      p
    ),
  ]);

  apply(propsR.rows as { user_id: unknown; c: unknown }[], 'propertyCount');
  apply(leaseR.rows as { user_id: unknown; c: unknown }[], 'leaseCount');
  apply(reqR.rows as { user_id: unknown; c: unknown }[], 'maintenanceRequestCount');
  apply(docR.rows as { user_id: unknown; c: unknown }[], 'documentCount');
  apply(ticketR.rows as { user_id: unknown; c: unknown }[], 'supportTicketCount');
  apply(tenancyR.rows as { user_id: unknown; c: unknown }[], 'leaseTenancyCount');
  apply(submittedR.rows as { user_id: unknown; c: unknown }[], 'maintenanceRequestSubmittedCount');

  return byId;
}

/**
 * Resolves a table and returns true when it exists. Some tables referenced
 * below are feature-flagged / not present in all environments (e.g., the
 * document center rolls out gradually); ignoring missing ones keeps the
 * cascade robust across migration levels.
 */
async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const r = await client.query<{ exists_flag: number }>(
    `SELECT CASE WHEN OBJECT_ID(N'dbo.' + $1, N'U') IS NULL THEN 0 ELSE 1 END AS exists_flag`,
    [tableName]
  );
  return (r.rows[0]?.exists_flag ?? 0) === 1;
}

async function deleteIfExists(
  client: PoolClient,
  tableName: string,
  whereClause: string,
  params: unknown[]
): Promise<void> {
  if (!(await tableExists(client, tableName))) return;
  await client.query(`DELETE FROM ${tableName} WHERE ${whereClause}`, params);
}

async function nullOutIfExists(
  client: PoolClient,
  tableName: string,
  setClause: string,
  whereClause: string,
  params: unknown[]
): Promise<void> {
  if (!(await tableExists(client, tableName))) return;
  await client.query(
    `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`,
    params
  );
}

/** Reassign a NOT NULL user ref so DELETE users is not blocked (NO ACTION edges). */
async function reassignToActorIfExists(
  client: PoolClient,
  tableName: string,
  setColumn: string,
  whereColumn: string,
  targetUserId: string,
  actorUserId: string
): Promise<void> {
  if (!(await tableExists(client, tableName))) return;
  await client.query(
    `UPDATE ${tableName} SET ${setColumn} = $2 WHERE ${whereColumn} = $1`,
    [targetUserId, actorUserId]
  );
}

/**
 * Deletes the user and everything they own.
 *
 * @throws Error when the admin is trying to delete themselves, or when the
 *         deletion is blocked by a FK we did not know to cascade.
 */
export async function hardDeleteUserAndOwnedData(
  pool: Pool,
  params: {
    actorUserId: string;
    targetUser: UserRow;
    reason: string;
  }
): Promise<DeleteUserSummary> {
  const { actorUserId, targetUser, reason } = params;
  if (actorUserId === targetUser.id) {
    throw new Error('cannot_delete_self');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const summary = await countOwnedResources(client, targetUser.id);

    // 1. Collect property IDs owned by this user so we can cascade through leases, etc.
    const propRows = await client.query<{ id: string }>(
      `SELECT id FROM properties WHERE created_by = $1`,
      [targetUser.id]
    );
    const propertyIds = propRows.rows.map((r) => r.id);

    // 2. Collect lease IDs under those properties.
    let leaseIds: string[] = [];
    if (propertyIds.length > 0) {
      const leaseRows = await client.query<{ id: string }>(
        `SELECT id FROM leases WHERE property_id IN (${propertyIds.map((_, i) => `$${i + 1}`).join(',')})`,
        propertyIds
      );
      leaseIds = leaseRows.rows.map((r) => r.id);
    }

    // 3. Collect maintenance request IDs: requests on this landlord's properties, plus
    //    any request the user submitted (e.g. tenant) so submitted_by_user_id (NO ACTION)
    //    does not block DELETE users.
    let requestIds: string[] = [];
    if (propertyIds.length > 0) {
      const reqRows = await client.query<{ id: string }>(
        `SELECT id FROM maintenance_requests WHERE property_id IN (${propertyIds.map((_, i) => `$${i + 1}`).join(',')})`,
        propertyIds
      );
      requestIds = reqRows.rows.map((r) => r.id);
    }
    const submittedReqRows = await client.query<{ id: string }>(
      `SELECT id FROM maintenance_requests WHERE submitted_by_user_id = $1`,
      [targetUser.id]
    );
    const requestIdSet = new Map<string, string>();
    for (const id of requestIds) requestIdSet.set(id, id);
    for (const r of submittedReqRows.rows) requestIdSet.set(r.id, r.id);
    requestIds = Array.from(requestIdSet.values());

    const placeholders = (ids: string[]): string =>
      ids.map((_, i) => `$${i + 1}`).join(',');

    // 3a. User references that are not limited to this user's owned properties/leases
    //     (tenants, metrics, contact, policy overrides, document center, Elsa config, etc.).
    await deleteIfExists(
      client,
      'portal_notification_events',
      'user_id = $1',
      [targetUser.id]
    );
    await deleteIfExists(
      client,
      'lease_notice_co_signs',
      'tenant_user_id = $1',
      [targetUser.id]
    );
    await deleteIfExists(
      client,
      'landlord_tenant_blocks',
      'landlord_user_id = $1 OR tenant_user_id = $1',
      [targetUser.id]
    );
    await deleteIfExists(
      client,
      'tenant_portal_access',
      'landlord_user_id = $1 OR tenant_user_id = $1',
      [targetUser.id]
    );
    await deleteIfExists(
      client,
      'contact_request_messages',
      'author_user_id = $1',
      [targetUser.id]
    );
    await deleteIfExists(
      client,
      'contact_reply_templates',
      'created_by = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'notification_scope_overrides',
      'overridden_by_user_id',
      'overridden_by_user_id',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'users',
      'document_center_suspended_by = NULL',
      'document_center_suspended_by = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'lease_notices',
      'given_by_user_id',
      'given_by_user_id',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'lease_notices',
      'counter_proposed_by = NULL, responded_by = NULL, withdrawn_by = NULL',
      'counter_proposed_by = $1 OR responded_by = $1 OR withdrawn_by = $1',
      [targetUser.id]
    );
    for (const t of [
      'lease_move_outs',
      'lease_evictions',
      'lease_deposits',
      'lease_deposit_dispositions',
    ] as const) {
      await nullOutIfExists(
        client,
        t,
        'created_by = NULL, updated_by = NULL',
        'created_by = $1 OR updated_by = $1',
        [targetUser.id]
      );
    }
    await nullOutIfExists(
      client,
      'leases',
      'ended_by = NULL',
      'ended_by = $1',
      [targetUser.id]
    );
    for (const t of [
      'elsa_settings',
      'elsa_property_policies',
      'elsa_category_policies',
      'elsa_priority_policies',
    ] as const) {
      await nullOutIfExists(
        client,
        t,
        'updated_by_user_id = NULL',
        'updated_by_user_id = $1',
        [targetUser.id]
      );
    }
    await nullOutIfExists(
      client,
      'elsa_request_policies',
      'updated_by_user_id = NULL',
      'updated_by_user_id = $1',
      [targetUser.id]
    );
    await nullOutIfExists(
      client,
      'elsa_decisions',
      'reviewed_by_user_id = NULL, triggering_user_id = NULL',
      'reviewed_by_user_id = $1 OR triggering_user_id = $1',
      [targetUser.id]
    );
    await nullOutIfExists(
      client,
      'attachment_upload_config',
      'updated_by_user_id = NULL',
      'updated_by_user_id = $1',
      [targetUser.id]
    );
    await nullOutIfExists(
      client,
      'lease_payment_entries',
      'recorded_by = NULL',
      'recorded_by = $1',
      [targetUser.id]
    );

    // 3b. Document center: other landlords' documents may still reference the user as
    //     uploader, visibility subject, or share revoker. Landlord-owned rows are removed in step 6.
    await deleteIfExists(
      client,
      'document_visibility_grants',
      'tenant_user_id = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'document_upload_intents',
      'uploaded_by_user_id',
      'uploaded_by_user_id',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'document_upload_intents',
      'subject_tenant_user_id = NULL',
      'subject_tenant_user_id = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'document_access_holds',
      'created_by',
      'created_by',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'document_access_holds',
      'revoked_by = NULL',
      'revoked_by = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'documents',
      'uploaded_by_user_id',
      'uploaded_by_user_id',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'documents',
      'subject_tenant_user_id = NULL, deleted_by = NULL, restored_by = NULL, purged_by = NULL, legal_hold_by = NULL',
      'subject_tenant_user_id = $1 OR deleted_by = $1 OR restored_by = $1 OR purged_by = $1 OR legal_hold_by = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'document_share_links',
      'created_by_landlord_id',
      'created_by_landlord_id',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'document_share_links',
      'revoked_by = NULL',
      'revoked_by = $1',
      [targetUser.id]
    );
    await reassignToActorIfExists(
      client,
      'document_visibility_grants',
      'created_by',
      'created_by',
      targetUser.id,
      actorUserId
    );
    await nullOutIfExists(
      client,
      'document_visibility_grants',
      'revoked_by = NULL',
      'revoked_by = $1',
      [targetUser.id]
    );

    // 4. Delete tenant-lifecycle rows tied to the user's leases.
    if (leaseIds.length > 0) {
      const ph = placeholders(leaseIds);
      await deleteIfExists(client, 'lease_renewal_offers', `lease_id IN (${ph})`, leaseIds);
      await deleteIfExists(client, 'lease_move_outs', `lease_id IN (${ph})`, leaseIds);
      await deleteIfExists(client, 'lease_evictions', `lease_id IN (${ph})`, leaseIds);
      await deleteIfExists(client, 'lease_notices', `lease_id IN (${ph})`, leaseIds);
      await deleteIfExists(client, 'lease_payment_entries', `lease_id IN (${ph})`, leaseIds);
      await deleteIfExists(client, 'document_share_links', `lease_id IN (${ph})`, leaseIds);
      await deleteIfExists(client, 'documents', `lease_id IN (${ph})`, leaseIds);
    }

    // 5. Tenant-transfer rows referencing this landlord directly.
    await deleteIfExists(
      client,
      'tenant_transfers',
      `landlord_user_id = $1 OR tenant_user_id = $1`,
      [targetUser.id]
    );
    await deleteIfExists(
      client,
      'tenant_transfer_requests',
      `landlord_user_id = $1 OR tenant_user_id = $1`,
      [targetUser.id]
    );

    // 6. Documents owned by this landlord (not already covered via lease_id).
    await deleteIfExists(client, 'documents', `landlord_id = $1`, [targetUser.id]);

    // 7. Maintenance-request children. request_status_history / attachments /
    //    messages / message_attachments all cascade on request delete, but the
    //    sender_user_id and uploaded_by_user_id columns are NO ACTION when the
    //    user is deleted directly — so delete the requests first to release them.
    if (requestIds.length > 0) {
      const ph = placeholders(requestIds);
      // ElSA-related request rows (if the feature tables are present)
      await deleteIfExists(client, 'elsa_request_decisions', `request_id IN (${ph})`, requestIds);
      await deleteIfExists(client, 'elsa_request_auto_responses', `request_id IN (${ph})`, requestIds);
      await client.query(
        `DELETE FROM maintenance_requests WHERE id IN (${ph})`,
        requestIds
      );
    }

    // 8. Leases (lease_tenants CASCADEs on lease delete).
    if (leaseIds.length > 0) {
      await client.query(
        `DELETE FROM leases WHERE id IN (${placeholders(leaseIds)})`,
        leaseIds
      );
    }

    // 9. Properties (elsa_property_policies CASCADEs, listing_sync SET NULLs).
    if (propertyIds.length > 0) {
      await client.query(
        `DELETE FROM properties WHERE id IN (${placeholders(propertyIds)})`,
        propertyIds
      );
    }

    // 10. Support tickets authored, uploaded, or acted on by this user.
    await deleteIfExists(
      client,
      'support_ticket_attachments',
      `uploaded_by_user_id = $1`,
      [targetUser.id]
    );
    await deleteIfExists(client, 'support_ticket_comments', `author_user_id = $1`, [
      targetUser.id,
    ]);
    await deleteIfExists(client, 'support_ticket_events', `actor_user_id = $1`, [
      targetUser.id,
    ]);
    await deleteIfExists(
      client,
      'support_tickets',
      `user_id = $1 OR assignee_user_id = $1`,
      [targetUser.id]
    );

    // 11. Unlink residual references from lease/property metadata.
    await nullOutIfExists(
      client,
      'properties',
      `updated_by = NULL`,
      `updated_by = $1`,
      [targetUser.id]
    );
    await nullOutIfExists(
      client,
      'leases',
      `updated_by = NULL, created_by = NULL`,
      `updated_by = $1 OR created_by = $1`,
      [targetUser.id]
    );

    // 12. Record the deletion. before_json captures what we're removing so a
    //     future dispute is traceable even with the row gone.
    await writeAudit(client, {
      actorUserId,
      entityType: 'USER',
      entityId: targetUser.id,
      action: 'HARD_DELETE',
      before: {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          first_name: targetUser.first_name,
          last_name: targetUser.last_name,
          role: targetUser.role,
          status: targetUser.status,
        },
        owned_counts: summary,
      },
      after: { reason },
    });

    // 13. Finally, the user row. lease_tenants / portal_notifications /
    //     notification preference tables / attachment_upload_config cascade
    //     automatically (ON DELETE CASCADE in migrations 017/018/019/035/015).
    await client.query(`DELETE FROM users WHERE id = $1`, [targetUser.id]);

    await client.query('COMMIT');
    return summary;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures; the original error is what matters.
    }
    throw error;
  } finally {
    client.release();
  }
}
