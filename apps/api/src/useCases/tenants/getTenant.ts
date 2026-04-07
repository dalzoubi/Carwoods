import { getTenantById, listLeasesForTenant, type TenantRow, type TenantLeaseRow } from '../../lib/tenantsRepo.js';
import { forbidden, notFound } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type GetTenantInput = {
  actorUserId: string;
  actorRole: string;
  tenantId: string;
};

export type GetTenantOutput = {
  tenant: TenantRow;
  leases: TenantLeaseRow[];
};

export async function getTenant(
  db: TransactionPool,
  input: GetTenantInput
): Promise<GetTenantOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const tenant = await getTenantById(db, input.tenantId, input.actorRole, input.actorUserId);
  if (!tenant) throw notFound('tenant_not_found');

  const leases = await listLeasesForTenant(
    db,
    input.tenantId,
    input.actorRole,
    input.actorUserId
  );

  return { tenant, leases };
}
