/**
 * Activate or deactivate a landlord account (admin-only).
 *
 * Business rules:
 * - Actor must be ADMIN.
 * - The target user must exist and have the LANDLORD role.
 */

import {
  setLandlordActiveStatus,
  type UserRow,
} from '../../lib/usersRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type SetLandlordActiveInput = {
  actorUserId: string;
  actorRole: string;
  landlordId: string | undefined;
  active: boolean;
};

export type SetLandlordActiveOutput = {
  landlord: UserRow;
};

export async function setLandlordActive(
  db: TransactionPool,
  input: SetLandlordActiveInput
): Promise<SetLandlordActiveOutput> {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();
  if (!input.landlordId) throw validationError('missing_id');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await setLandlordActiveStatus(client, input.landlordId, input.active);
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LANDLORD',
      entityId: input.landlordId,
      action: input.active ? 'REACTIVATE' : 'DEACTIVATE',
      before: null,
      after: updated,
    });
    await client.query('COMMIT');
    return { landlord: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
