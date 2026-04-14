/**
 * Create or reactivate a landlord user by email (admin-only).
 *
 * Business rules:
 * - Actor must be ADMIN.
 * - Email, first_name, and last_name are required and validated.
 * - If the email already belongs to an ADMIN user → conflict.
 * - If the email already belongs to a non-LANDLORD/non-ADMIN user → conflict.
 * - Otherwise: creates a new LANDLORD user or reactivates an existing one.
 */

import {
  upsertLandlordUserByEmail,
  type UserRow,
  type UpsertLandlordResult,
} from '../../lib/usersRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { enqueueNotification } from '../../lib/notificationRepo.js';
import { validateLandlordInvite } from '../../domain/userValidation.js';
import { conflictError, forbidden, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type InviteLandlordInput = {
  actorUserId: string;
  actorRole: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type InviteLandlordOutput = {
  landlord: UserRow;
  landlord_created: boolean;
};

export async function inviteLandlord(
  db: TransactionPool,
  input: InviteLandlordInput
): Promise<InviteLandlordOutput> {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();

  const inviteValidation = validateLandlordInvite({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (!inviteValidation.valid) throw validationError(inviteValidation.message);

  const client = await db.connect();
  let result: UpsertLandlordResult;
  try {
    await client.query('BEGIN');
    try {
      result = await upsertLandlordUserByEmail(
        client as Parameters<typeof upsertLandlordUserByEmail>[0],
        {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
        }
      );
    } catch (e) {
      await client.query('ROLLBACK');
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'email_belongs_to_admin') throw conflictError('email_belongs_to_admin');
      if (msg === 'email_already_used_by_non_landlord') throw conflictError('email_already_used');
      throw e;
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LANDLORD',
      entityId: result.user.id,
      action: result.created ? 'CREATE' : 'UPDATE',
      before: null,
      after: result.user,
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (result.created) {
    const notifyClient = await db.connect();
    try {
      try {
        await enqueueNotification(notifyClient as Parameters<typeof enqueueNotification>[0], {
          eventTypeCode: 'ACCOUNT_LANDLORD_CREATED',
          payload: {
            landlord_user_id: result.user.id,
            landlord_email: result.user.email,
            email: result.user.email,
            first_name: result.user.first_name,
            last_name: result.user.last_name,
            source: 'ADMIN_INVITE',
            invited_by_user_id: input.actorUserId,
          },
          idempotencyKey: `account-landlord-created:${result.user.id}:invite`,
        });
      } catch {
        // Non-blocking: landlord row is already committed; outbox can be retried manually if needed.
      }
    } finally {
      notifyClient.release();
    }
  }

  return { landlord: result.user, landlord_created: result.created };
}
