import { listTenantsForActor, type TenantWithContextRow } from '../../lib/tenantsRepo.js';
import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type ListTenantsInput = {
  actorUserId: string;
  actorRole: string;
  landlordId?: string | null;
};

export type ListTenantsOutput = {
  tenants: TenantWithContextRow[];
};

export async function listTenants(
  db: TransactionPool,
  input: ListTenantsInput
): Promise<ListTenantsOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const tenants = await listTenantsForActor(
    db,
    input.actorRole,
    input.actorUserId,
    input.landlordId
  );
  return { tenants };
}
