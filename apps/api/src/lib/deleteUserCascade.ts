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
};

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
       (SELECT COUNT(*) FROM support_tickets st WHERE st.user_id = $1) AS ticket_count`,
    [userId]
  );
  const row = rows.rows[0] ?? {
    property_count: 0,
    lease_count: 0,
    request_count: 0,
    document_count: 0,
    ticket_count: 0,
  };
  return {
    userId,
    propertyCount: Number(row.property_count ?? 0),
    leaseCount: Number(row.lease_count ?? 0),
    maintenanceRequestCount: Number(row.request_count ?? 0),
    documentCount: Number(row.document_count ?? 0),
    supportTicketCount: Number(row.ticket_count ?? 0),
  };
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

    // 3. Collect maintenance request IDs under those properties.
    let requestIds: string[] = [];
    if (propertyIds.length > 0) {
      const reqRows = await client.query<{ id: string }>(
        `SELECT id FROM maintenance_requests WHERE property_id IN (${propertyIds.map((_, i) => `$${i + 1}`).join(',')})`,
        propertyIds
      );
      requestIds = reqRows.rows.map((r) => r.id);
    }

    const placeholders = (ids: string[]): string =>
      ids.map((_, i) => `$${i + 1}`).join(',');

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
