/**
 * List landlord users (admin-only).
 */

import { listLandlords as listLandlordsRepo, type UserRow } from '../../lib/usersRepo.js';
import { forbidden } from '../../domain/errors.js';
import { Role } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListLandlordsInput = {
  actorUserId: string;
  actorRole: string;
  includeInactive?: boolean;
};

export type ListLandlordsOutput = {
  landlords: UserRow[];
};

export async function listLandlords(
  db: Queryable,
  input: ListLandlordsInput
): Promise<ListLandlordsOutput> {
  if (input.actorRole.trim().toUpperCase() !== Role.ADMIN) throw forbidden();
  const landlords = await listLandlordsRepo(db, { includeInactive: input.includeInactive });
  return { landlords };
}
