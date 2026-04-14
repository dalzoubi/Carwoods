/**
 * List landlord users (admin-only).
 */

import { listLandlords as listLandlordsRepo, type LandlordAdminListRow } from '../../lib/usersRepo.js';
import { profilePhotoReadUrlFromStoragePath } from '../../lib/userProfilePhotoUrl.js';
import { forbidden } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListLandlordsInput = {
  actorUserId: string;
  actorRole: string;
  includeInactive?: boolean;
};

export type LandlordAdminListItem = LandlordAdminListRow & {
  profile_photo_url: string | null;
};

export type ListLandlordsOutput = {
  landlords: LandlordAdminListItem[];
};

export async function listLandlords(
  db: Queryable,
  input: ListLandlordsInput
): Promise<ListLandlordsOutput> {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();
  const landlords = await listLandlordsRepo(db, { includeInactive: input.includeInactive });
  return {
    landlords: landlords.map((row) => ({
      ...row,
      profile_photo_url: profilePhotoReadUrlFromStoragePath(row.profile_photo_storage_path),
    })),
  };
}
