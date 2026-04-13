import { findUserById, setUserTier, type UserRow } from '../../lib/usersRepo.js';
import { getTierById } from '../../lib/subscriptionTiersRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type AssignLandlordTierInput = {
  actorUserId: string;
  actorRole: string;
  landlordId: string;
  tierId: string;
};

export type AssignLandlordTierOutput = {
  landlord: UserRow;
};

export async function assignLandlordTier(
  db: TransactionPool,
  input: AssignLandlordTierInput
): Promise<AssignLandlordTierOutput> {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const landlord = await findUserById(
      client as Parameters<typeof findUserById>[0],
      input.landlordId
    );
    if (!landlord) {
      await client.query('ROLLBACK');
      throw notFound('landlord_not_found');
    }
    if (String(landlord.role).toUpperCase() !== Role.LANDLORD) {
      await client.query('ROLLBACK');
      throw forbidden('not_a_landlord');
    }

    const tier = await getTierById(client as Parameters<typeof getTierById>[0], input.tierId);
    if (!tier) {
      await client.query('ROLLBACK');
      throw validationError('tier_not_found');
    }

    const oldTierId = landlord.tier_id;
    const updated = await setUserTier(
      client as Parameters<typeof setUserTier>[0],
      input.landlordId,
      input.tierId
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw new Error('set_user_tier_failed');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'USER',
      entityId: input.landlordId,
      action: 'UPDATE',
      before: { tier_id: oldTierId },
      after: { tier_id: input.tierId },
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
