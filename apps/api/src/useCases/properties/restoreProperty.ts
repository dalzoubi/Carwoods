/**
 * Restore a soft-deleted property (management access required).
 */

import {
  getPropertyByIdForActorIncludeDeleted,
  restoreProperty as restorePropertyRepo,
} from '../../lib/propertiesRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type RestorePropertyInput = {
  propertyId: string | undefined;
  actorUserId: string;
  actorRole: string;
};

export async function restoreProperty(
  db: TransactionPool,
  input: RestorePropertyInput
): Promise<void> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  if (!input.propertyId) throw validationError('missing_id');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const before = await getPropertyByIdForActorIncludeDeleted(
      client,
      input.propertyId,
      input.actorRole,
      input.actorUserId
    );
    if (!before) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const ok = await restorePropertyRepo(
      client as Parameters<typeof restorePropertyRepo>[0],
      input.propertyId,
      input.actorUserId
    );
    if (!ok) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const after = await getPropertyByIdForActorIncludeDeleted(
      client,
      input.propertyId,
      input.actorRole,
      input.actorUserId
    );
    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'PROPERTY',
      entityId: input.propertyId,
      action: 'RESTORE',
      before,
      after,
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
