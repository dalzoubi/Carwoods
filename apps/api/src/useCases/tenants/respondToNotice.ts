/**
 * Landlord responds to a notice: accept, counter-propose, or reject. Requires the notice to be
 * in 'pending_landlord' state and the actor to own the property for the notice's lease.
 */

import { getLeaseById } from '../../lib/leasesRepo.js';
import { getPropertyByIdForActor } from '../../lib/propertiesRepo.js';
import {
  getNoticeById,
  setNoticeStatus,
  setNoticeCounterProposal,
} from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { conflictError, forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type NoticeDecision = 'accept' | 'counter' | 'reject';

export type RespondToNoticeInput = {
  actorUserId: string;
  actorRole: string;
  noticeId: string;
  decision: NoticeDecision;
  counterDate?: string | null;
  counterNotes?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function respondToNotice(db: TransactionPool, input: RespondToNoticeInput) {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const noticeId = String(input.noticeId ?? '').trim();
  if (!noticeId) throw validationError('missing_notice_id');

  if (input.decision !== 'accept' && input.decision !== 'counter' && input.decision !== 'reject') {
    throw validationError('invalid_decision');
  }

  const notice = await getNoticeById(db, noticeId);
  if (!notice) throw notFound('notice_not_found');
  if (notice.status !== 'pending_landlord') throw conflictError('notice_not_awaiting_landlord');

  const lease = await getLeaseById(db, notice.lease_id);
  if (!lease) throw notFound('lease_not_found');

  const prop = await getPropertyByIdForActor(db, lease.property_id, input.actorRole, input.actorUserId);
  if (!prop) throw forbidden();

  if (input.decision === 'counter') {
    const counterDate = String(input.counterDate ?? '').trim();
    if (!ISO_DATE.test(counterDate)) throw validationError('invalid_counter_date');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let updated = notice;
    if (input.decision === 'accept' || input.decision === 'reject') {
      const nextStatus = input.decision === 'accept' ? 'accepted' : 'rejected';
      const next = await setNoticeStatus(
        client as Parameters<typeof setNoticeStatus>[0],
        noticeId,
        nextStatus,
        input.actorUserId
      );
      if (!next) {
        await client.query('ROLLBACK');
        throw notFound('notice_not_found');
      }
      updated = next;
    } else {
      const next = await setNoticeCounterProposal(
        client as Parameters<typeof setNoticeCounterProposal>[0],
        {
          noticeId,
          counterDate: String(input.counterDate),
          counterNotes: input.counterNotes ?? null,
          actorUserId: input.actorUserId,
        }
      );
      if (!next) {
        await client.query('ROLLBACK');
        throw notFound('notice_not_found');
      }
      updated = next;
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_NOTICE',
      entityId: noticeId,
      action:
        input.decision === 'accept'
          ? 'ACCEPT_NOTICE'
          : input.decision === 'reject'
            ? 'REJECT_NOTICE'
            : 'COUNTER_NOTICE',
      before: notice,
      after: updated,
    });

    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'LEASE_NOTICE_RESPONDED',
      payload: {
        notice_id: noticeId,
        lease_id: notice.lease_id,
        planned_move_out_date: notice.planned_move_out_date,
        decision: input.decision,
        counter_date: input.decision === 'counter' ? input.counterDate ?? null : null,
        actor_user_id: input.actorUserId,
      },
      idempotencyKey: `lease-notice-responded:${noticeId}:${input.decision}`,
    });

    await client.query('COMMIT');
    return { notice: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
