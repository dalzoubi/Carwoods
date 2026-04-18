/**
 * The tenant who gave a notice withdraws it. Allowed only while the notice is still live
 * (pending_co_signers, pending_landlord, pending_tenant). Terminal states cannot be withdrawn.
 */

import { getNoticeById, setNoticeStatus } from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { conflictError, forbidden, notFound, validationError } from '../../domain/errors.js';
import type { TransactionPool } from '../types.js';

export type WithdrawNoticeInput = {
  actorUserId: string;
  noticeId: string;
};

const LIVE_STATES = new Set(['pending_co_signers', 'pending_landlord', 'pending_tenant']);

export async function withdrawNotice(db: TransactionPool, input: WithdrawNoticeInput) {
  const noticeId = String(input.noticeId ?? '').trim();
  if (!noticeId) throw validationError('missing_notice_id');

  const notice = await getNoticeById(db, noticeId);
  if (!notice) throw notFound('notice_not_found');
  if (notice.given_by_user_id !== input.actorUserId) throw forbidden('not_notice_author');
  if (!LIVE_STATES.has(notice.status)) throw conflictError('notice_not_live');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updated = await setNoticeStatus(
      client as Parameters<typeof setNoticeStatus>[0],
      noticeId,
      'withdrawn',
      input.actorUserId
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound('notice_not_found');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_NOTICE',
      entityId: noticeId,
      action: 'WITHDRAW_NOTICE',
      before: notice,
      after: updated,
    });

    await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
      eventTypeCode: 'LEASE_NOTICE_WITHDRAWN',
      payload: {
        notice_id: noticeId,
        lease_id: notice.lease_id,
        planned_move_out_date: notice.planned_move_out_date,
        actor_user_id: input.actorUserId,
      },
      idempotencyKey: `lease-notice-withdrawn:${noticeId}`,
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
