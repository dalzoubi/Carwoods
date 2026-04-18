/**
 * Admin-only: mark a landlord↔tenant re-rent block as overridden so the tenant can be
 * re-onboarded by the same landlord. Keeps the history row for audit.
 */

import { overrideRerentBlock as overrideBlock } from '../../lib/tenantLifecycleRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound, validationError } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type OverrideRerentBlockInput = {
  actorUserId: string;
  actorRole: string;
  blockId: string;
  overrideNotes?: string | null;
};

export async function overrideRerentBlock(
  db: TransactionPool,
  input: OverrideRerentBlockInput
) {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();

  const blockId = String(input.blockId ?? '').trim();
  if (!blockId) throw validationError('missing_block_id');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updated = await overrideBlock(
      client as Parameters<typeof overrideBlock>[0],
      blockId,
      input.actorUserId,
      input.overrideNotes ?? null
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound('block_not_found_or_already_overridden');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'LANDLORD_TENANT_BLOCK',
      entityId: blockId,
      action: 'OVERRIDE',
      before: null,
      after: updated,
    });

    await client.query('COMMIT');
    return { block: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
