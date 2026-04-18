/**
 * Tenant gives notice on a lease they are on. Creates a lease_notices row plus co-sign rows
 * for the other tenants (if scope = all_tenants). Rejects if a live notice already exists.
 */

import { getLeaseById, listLeaseTenantUserIds } from '../../lib/leasesRepo.js';
import {
  getLiveNoticeForLease,
  insertNotice,
  insertCoSignRows,
  type ForwardingAddress,
  type NoticeReason,
  type NoticeScope,
} from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { conflictError, forbidden, notFound, validationError } from '../../domain/errors.js';
import type { TransactionPool } from '../types.js';

export type GiveNoticeInput = {
  actorUserId: string;
  leaseId: string;
  givenOn?: string | null;
  plannedMoveOutDate: string;
  reason?: NoticeReason | null;
  reasonNotes?: string | null;
  scope: NoticeScope;
  earlyTermination?: boolean;
  forwarding?: Partial<ForwardingAddress> | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function giveNotice(db: TransactionPool, input: GiveNoticeInput) {
  const leaseId = String(input.leaseId ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');

  const plannedMoveOutDate = String(input.plannedMoveOutDate ?? '').trim();
  if (!ISO_DATE.test(plannedMoveOutDate)) throw validationError('invalid_planned_move_out_date');

  const givenOn = String(input.givenOn ?? new Date().toISOString().slice(0, 10)).trim();
  if (!ISO_DATE.test(givenOn)) throw validationError('invalid_given_on');

  if (input.scope !== 'all_tenants' && input.scope !== 'self_only') {
    throw validationError('invalid_scope');
  }

  const lease = await getLeaseById(db, leaseId);
  if (!lease) throw notFound('lease_not_found');
  if (lease.status === 'ENDED' || lease.status === 'TERMINATED') {
    throw validationError('lease_already_ended');
  }

  const tenantIds = await listLeaseTenantUserIds(db, leaseId);
  if (!tenantIds.includes(input.actorUserId)) throw forbidden('not_on_lease');

  const existing = await getLiveNoticeForLease(db, leaseId);
  if (existing) throw conflictError('notice_already_live');

  const otherTenantIds = tenantIds.filter((id) => id !== input.actorUserId);
  const needsCoSign = input.scope === 'all_tenants' && otherTenantIds.length > 0;
  const status = needsCoSign ? 'pending_co_signers' : 'pending_landlord';

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const notice = await insertNotice(client as Parameters<typeof insertNotice>[0], {
      leaseId,
      givenByUserId: input.actorUserId,
      givenOn,
      plannedMoveOutDate,
      reason: input.reason ?? null,
      reasonNotes: input.reasonNotes ?? null,
      scope: input.scope,
      earlyTermination: Boolean(input.earlyTermination),
      status,
      forwarding: input.forwarding ?? null,
    });

    if (needsCoSign) {
      await insertCoSignRows(
        client as Parameters<typeof insertCoSignRows>[0],
        notice.id,
        otherTenantIds
      );
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_NOTICE',
      entityId: notice.id,
      action: 'GIVE_NOTICE',
      before: null,
      after: notice,
    });

    await client.query('COMMIT');
    return { notice };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
