/**
 * List all non-deleted properties (management access required).
 */

import { listPropertiesLandlord, type PropertyRowFull } from '../../lib/propertiesRepo.js';
import { forbidden } from '../../domain/errors.js';
import { hasLandlordAccess } from '../../domain/constants.js';
import type { Queryable } from '../types.js';

export type ListPropertiesInput = {
  actorUserId: string;
  actorRole: string;
};

export type ListPropertiesOutput = {
  properties: PropertyRowFull[];
};

export async function listProperties(
  db: Queryable,
  input: ListPropertiesInput
): Promise<ListPropertiesOutput> {
  if (!hasLandlordAccess(input.actorRole)) throw forbidden();
  const properties = await listPropertiesLandlord(db);
  return { properties };
}
