/**
 * Co-tenant signs a notice. When every co-sign row is signed, the notice moves from
 * 'pending_co_signers' to 'pending_landlord'.
 */

import {
  getNoticeById,
  signCoSign,
  countUnsignedCoSigns,
  setNoticeStatus,
} from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { conflictError, forbidden, notFound, validationError } from '../../domain/errors.js';
import type { TransactionPool } from '../types.js';

export type CoSignNoticeInput = {
  actorUserId: string;
  noticeId: string;
};

export async function coSignNotice(db: TransactionPool, input: CoSignNoticeInput) {
  const noticeId = String(input.noticeId ?? '').trim();
  if (!noticeId) throw validationError('missing_notice_id');

  const notice = await getNoticeById(db, noticeId);
  if (!notice) throw notFound('notice_not_found');
  if (notice.status !== 'pending_co_signers') throw conflictError('notice_not_awaiting_co_signers');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const signed = await signCoSign(
      client as Parameters<typeof signCoSign>[0],
      noticeId,
      input.actorUserId
    );
    if (!signed) {
      await client.query('ROLLBACK');
      throw forbidden('not_a_co_signer_or_already_signed');
    }

    const remaining = await countUnsignedCoSigns(
      client as Parameters<typeof countUnsignedCoSigns>[0],
      noticeId
    );
    let updated = notice;
    if (remaining === 0) {
      const next = await setNoticeStatus(
        client as Parameters<typeof setNoticeStatus>[0],
        noticeId,
        'pending_landlord',
        input.actorUserId
      );
      if (next) updated = next;
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LEASE_NOTICE',
      entityId: noticeId,
      action: 'CO_SIGN_NOTICE',
      before: notice,
      after: updated,
    });

    if (remaining === 0) {
      await enqueueNotification(client as Parameters<typeof enqueueNotification>[0], {
        eventTypeCode: 'LEASE_NOTICE_CO_SIGNED',
        payload: {
          notice_id: noticeId,
          lease_id: notice.lease_id,
          planned_move_out_date: notice.planned_move_out_date,
          actor_user_id: input.actorUserId,
        },
        idempotencyKey: `lease-notice-co-signed:${noticeId}`,
      });
    }

    await client.query('COMMIT');
    return { notice: updated, pending_co_signers_remaining: remaining };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
