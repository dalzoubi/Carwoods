/**
 * Finalize a lease move-out: flip to ENDED, persist move-out detail, clear any live notice,
 * grant a 60-day READ_ONLY portal-access window per co-tenant (per landlord), audit.
 *
 * Does not change tenant account status. If a tenant has no other active lease with any
 * landlord, the portal-access row carries the only gating signal.
 */

import {
  getLeaseById,
  setLeaseEnded,
  clearLeaseNotice,
  listLeaseTenantUserIds,
} from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  upsertMoveOut,
  upsertPortalAccess,
  type ForwardingAddress,
} from '../../lib/tenantLifecycleRepo.js';
import { getLiveNoticeForLease, setNoticeStatus } from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

const DEFAULT_GRACE_DAYS = 60;

export type MoveOutLeaseInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string;
  endedOn: string;
  endedReason?: 'end_of_term' | 'mutual' | 'other';
  endedNotes?: string | null;
  forwarding?: Partial<ForwardingAddress> | null;
  finalBalanceAmount?: number | null;
  inspectionNotes?: string | null;
  internalNotes?: string | null;
  /** Grace window in days; defaults to 60. */
  graceDays?: number;
};

function addDaysIso(date: Date, days: number): string {
  const d = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export async function moveOutLease(
  db: TransactionPool,
  input: MoveOutLeaseInput
) {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const leaseId = String(input.leaseId ?? '').trim();
  const endedOn = String(input.endedOn ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endedOn)) throw validationError('invalid_ended_on');

  const lease = await getLeaseById(db, leaseId);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  if (lease.status === 'ENDED' || lease.status === 'TERMINATED') {
    throw validationError('lease_already_ended');
  }

  const landlordUserId = prop.created_by;
  if (!landlordUserId) throw notFound('property_missing_owner');
  const tenantIds = await listLeaseTenantUserIds(db, leaseId);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updatedLease = await setLeaseEnded(client as Parameters<typeof setLeaseEnded>[0], {
      leaseId,
      status: 'ENDED',
      endedOn,
      endedReason: input.endedReason ?? 'end_of_term',
      endedBy: input.actorUserId,
      endedNotes: input.endedNotes ?? null,
    });
    if (!updatedLease) {
      await client.query('ROLLBACK');
      throw notFound('lease_not_found');
    }

    const moveOut = await upsertMoveOut(client as Parameters<typeof upsertMoveOut>[0], {
      leaseId,
      forwarding: input.forwarding ?? null,
      finalBalanceAmount: input.finalBalanceAmount ?? null,
      inspectionNotes: input.inspectionNotes ?? null,
      internalNotes: input.internalNotes ?? null,
      actorUserId: input.actorUserId,
    });

    await clearLeaseNotice(client as Parameters<typeof clearLeaseNotice>[0], leaseId, input.actorUserId);
    const liveNotice = await getLiveNoticeForLease(client as Parameters<typeof getLiveNoticeForLease>[0], leaseId);
    if (liveNotice) {
      await setNoticeStatus(
        client as Parameters<typeof setNoticeStatus>[0],
        liveNotice.id,
        'superseded',
        input.actorUserId
      );
    }

    const graceDays = input.graceDays ?? DEFAULT_GRACE_DAYS;
    const effectiveUntil = addDaysIso(new Date(), graceDays);
    for (const tenantUserId of tenantIds) {
      await upsertPortalAccess(client as Parameters<typeof upsertPortalAccess>[0], {
        tenantUserId,
        landlordUserId,
        sourceLeaseId: leaseId,
        accessLevel: 'READ_ONLY',
        effectiveUntil,
        reason: 'move_out',
        actorUserId: input.actorUserId,
      });
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: leaseId,
      action: 'MOVE_OUT',
      before: lease,
      after: updatedLease,
    });

    await client.query('COMMIT');
    return { lease: updatedLease, move_out: moveOut };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
