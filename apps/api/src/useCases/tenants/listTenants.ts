import { listTenantsForActor, type TenantWithContextRow } from '../../lib/tenantsRepo.js';
import { profilePhotoReadUrlFromStoragePath } from '../../lib/userProfilePhotoUrl.js';
import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { TransactionPool } from '../types.js';

export type ListTenantsInput = {
  actorUserId: string;
  actorRole: string;
  landlordId?: string | null;
};

export type TenantListItem = Omit<TenantWithContextRow, 'profile_photo_storage_path'> & {
  profile_photo_url: string | null;
};

export type ListTenantsOutput = {
  tenants: TenantListItem[];
};

export async function listTenants(
  db: TransactionPool,
  input: ListTenantsInput
): Promise<ListTenantsOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();

  const rows = await listTenantsForActor(
    db,
    input.actorRole,
    input.actorUserId,
    input.landlordId
  );
  return {
    tenants: rows.map((row) => {
      const { profile_photo_storage_path, ...rest } = row;
      return {
        ...rest,
        profile_photo_url: profilePhotoReadUrlFromStoragePath(profile_photo_storage_path),
      };
    }),
  };
}
