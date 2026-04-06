/**
 * Soft-delete a property (management access required).
 *
 * Business rules:
 * - Property must exist.
 */

import {
  getPropertyByIdForActor,
  softDeleteProperty,
} from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type DeletePropertyInput = {
  propertyId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export async function deleteProperty(
  db: TransactionPool,
  input: DeletePropertyInput
): Promise<void> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.propertyId) throw validationError('missing_id');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getPropertyByIdForActor(
      client,
      input.propertyId,
      input.actorRole,
      input.actorUserId
    );
    if (!before) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const ok = await softDeleteProperty(
      client as Parameters<typeof softDeleteProperty>[0],
      input.propertyId,
      input.actorUserId
    );
    if (!ok) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'PROPERTY',
      entityId: input.propertyId,
      action: 'DELETE',
      before,
      after: { deleted: true },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
