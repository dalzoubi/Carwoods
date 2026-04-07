import { getTenantById, setTenantStatus, type TenantRow } from '../../lib/tenantsRepo.js';
import { writeAudit } from '../../lib/auditRepo.js';
import { forbidden, notFound } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type SetTenantActiveInput = {
  actorUserId: string;
  actorRole: string;
  tenantId: string;
  active: boolean;
};

export type SetTenantActiveOutput = {
  tenant: TenantRow;
};

export async function setTenantActive(
  db: TransactionPool,
  input: SetTenantActiveInput
): Promise<SetTenantActiveOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  // Verify tenant exists and actor can access it
  const before = await getTenantById(db, input.tenantId, input.actorRole, input.actorUserId);
  if (!before) throw notFound('tenant_not_found');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updated = await setTenantStatus(
      client as Parameters<typeof setTenantStatus>[0],
      input.tenantId,
      input.active
    );
    if (!updated) {
      await client.query('ROLLBACK');
      throw notFound('tenant_not_found');
    }

    await writeAudit(client as Parameters<typeof writeAudit>[0], {
      actorUserId: input.actorUserId,
      entityType: 'TENANT',
      entityId: input.tenantId,
      action: 'UPDATE',
      before,
      after: updated,
    });

    await client.query('COMMIT');
    return { tenant: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
