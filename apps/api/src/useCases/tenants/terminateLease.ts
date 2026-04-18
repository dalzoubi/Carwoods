/**
 * Terminate a lease (eviction or early termination). Eviction revokes portal access immediately
 * and installs a re-rent block per co-tenant; early termination grants a 60-day READ_ONLY grace.
 */

import {
  getLeaseById,
  setLeaseEnded,
  clearLeaseNotice,
  listLeaseTenantUserIds,
} from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  upsertEviction,
  upsertMoveOut,
  upsertPortalAccess,
  insertRerentBlock,
  getActiveRerentBlock,
  getLiveNoticeForLease,
  setNoticeStatus,
  type ForwardingAddress,
} from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

const EARLY_TERM_GRACE_DAYS = 60;

export type TerminateLeaseInput = {
  actorUserId: string;
  actorRole: string;
  leaseId: string;
  kind: 'eviction' | 'early_termination';
  endedOn: string;
  endedNotes?: string | null;

  // early-termination only
  forwarding?: Partial<ForwardingAddress> | null;
  finalBalanceAmount?: number | null;
  earlyTerminationFeeAmount?: number | null;

  // eviction only
  caseNumber?: string | null;
  noticeServedOn?: string | null;
  judgmentDate?: string | null;
  judgmentAmount?: number | null;
  collectionsForwarded?: boolean;
  evictionDetails?: string | null;
};

export async function terminateLease(db: TransactionPool, input: TerminateLeaseInput) {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const leaseId = String(input.leaseId ?? '').trim();
  const endedOn = String(input.endedOn ?? '').trim();
  if (!leaseId) throw validationError('missing_lease_id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endedOn)) throw validationError('invalid_ended_on');
  if (input.kind !== 'eviction' && input.kind !== 'early_termination') {
    throw validationError('invalid_kind');
  }

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

    const endedReason = input.kind === 'eviction' ? 'eviction' : 'early_termination';
    const updatedLease = await setLeaseEnded(client as Parameters<typeof setLeaseEnded>[0], {
      leaseId,
      status: 'TERMINATED',
      endedOn,
      endedReason,
      endedBy: input.actorUserId,
      endedNotes: input.endedNotes ?? null,
    });
    if (!updatedLease) {
      await client.query('ROLLBACK');
      throw notFound('lease_not_found');
    }

    let detail: unknown = null;

    if (input.kind === 'eviction') {
      detail = await upsertEviction(client as Parameters<typeof upsertEviction>[0], {
        leaseId,
        caseNumber: input.caseNumber ?? null,
        noticeServedOn: input.noticeServedOn ?? null,
        judgmentDate: input.judgmentDate ?? null,
        judgmentAmount: input.judgmentAmount ?? null,
        collectionsForwarded: input.collectionsForwarded ?? false,
        details: input.evictionDetails ?? null,
        actorUserId: input.actorUserId,
      });

      for (const tenantUserId of tenantIds) {
        await upsertPortalAccess(client as Parameters<typeof upsertPortalAccess>[0], {
          tenantUserId,
          landlordUserId,
          sourceLeaseId: leaseId,
          accessLevel: 'REVOKED',
          effectiveUntil: null,
          reason: 'eviction',
          actorUserId: input.actorUserId,
        });
        const existing = await getActiveRerentBlock(
          client as Parameters<typeof getActiveRerentBlock>[0],
          landlordUserId,
          tenantUserId
        );
        if (!existing) {
          await insertRerentBlock(client as Parameters<typeof insertRerentBlock>[0], {
            landlordUserId,
            tenantUserId,
            sourceLeaseId: leaseId,
            reason: 'eviction',
            notes: input.evictionDetails ?? null,
            actorUserId: input.actorUserId,
          });
        }
      }
    } else {
      // early_termination: record move-out detail + fee + 60-day grace
      detail = await upsertMoveOut(client as Parameters<typeof upsertMoveOut>[0], {
        leaseId,
        forwarding: input.forwarding ?? null,
        finalBalanceAmount: input.finalBalanceAmount ?? null,
        internalNotes: input.endedNotes ?? null,
        actorUserId: input.actorUserId,
      });

      const graceMs = Date.now() + EARLY_TERM_GRACE_DAYS * 24 * 60 * 60 * 1000;
      const effectiveUntil = new Date(graceMs).toISOString();
      for (const tenantUserId of tenantIds) {
        await upsertPortalAccess(client as Parameters<typeof upsertPortalAccess>[0], {
          tenantUserId,
          landlordUserId,
          sourceLeaseId: leaseId,
          accessLevel: 'READ_ONLY',
          effectiveUntil,
          reason: 'early_termination',
          actorUserId: input.actorUserId,
        });
      }
    }

    await clearLeaseNotice(client as Parameters<typeof clearLeaseNotice>[0], leaseId, input.actorUserId);
    const liveNotice = await getLiveNoticeForLease(
      client as Parameters<typeof getLiveNoticeForLease>[0],
      leaseId
    );
    if (liveNotice) {
      await setNoticeStatus(
        client as Parameters<typeof setNoticeStatus>[0],
        liveNotice.id,
        'superseded',
        input.actorUserId
      );
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE',
      entityId: leaseId,
      action: input.kind === 'eviction' ? 'EVICT' : 'TERMINATE',
      before: lease,
      after: updatedLease,
    });

    await client.query('COMMIT');
    return { lease: updatedLease, detail };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
